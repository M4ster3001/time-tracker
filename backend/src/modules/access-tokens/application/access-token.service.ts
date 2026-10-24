import crypto from 'crypto';
import type { IAuthPayload } from '../../auth/domain/auth.types.js';
import { ForbiddenError, NotFoundError } from '../../../app/errors/app-error.js';
import { userRepository } from '../../users/infrastructure/repositories/prisma-user.repository.js';
import { accessTokenRepository as defaultAccessTokenRepository } from '../infrastructure/repositories/prisma-access-token.repository.js';
import type { AccessTokenRepository } from '../domain/repositories/access-token.repository.js';
import { isGrant, type Grant } from '../../access-control/domain/permissions.js';
import { assertPatGrantsProvided } from '../../access-control/domain/pat-grants-policy.js';
import { BadRequestError } from '../../../app/errors/app-error.js';
import type {
  AccessTokenExpiryDays,
  IAccessToken,
  IAccessTokenWithOwner,
  ICreatedAccessToken,
} from '../domain/access-token.types.js';

export const ACCESS_TOKEN_PREFIX = 'ttpat_';

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const generateAccessToken = async (
  userId: number,
  label: string,
  expiresInDays: AccessTokenExpiryDays,
  repository: AccessTokenRepository = defaultAccessTokenRepository,
  grants?: Grant[]
): Promise<ICreatedAccessToken> => {
  let explicitGrants: Grant[];
  try {
    explicitGrants = assertPatGrantsProvided(grants);
  } catch {
    throw new BadRequestError('PAT_GRANTS_REQUIRED');
  }

  const rawToken = `${ACCESS_TOKEN_PREFIX}${crypto.randomBytes(48).toString('hex')}`;
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const created = await repository.create(
    userId,
    label,
    tokenHash,
    expiresAt,
    JSON.stringify(explicitGrants)
  );
  return { ...created, rawToken };
};

export const listAccessTokensForUser = async (
  userId: number,
  repository: AccessTokenRepository = defaultAccessTokenRepository
): Promise<IAccessToken[]> => repository.listByUser(userId);

export const listAllAccessTokens = async (
  repository: AccessTokenRepository = defaultAccessTokenRepository
): Promise<IAccessTokenWithOwner[]> => repository.listAll();

export const revokeOwnAccessToken = async (
  userId: number,
  tokenId: number,
  repository: AccessTokenRepository = defaultAccessTokenRepository
): Promise<void> => {
  const existing = await repository.findById(tokenId);
  if (!existing) throw new NotFoundError('Token not found');
  if (existing.userId !== userId) throw new ForbiddenError('Forbidden');
  await repository.revoke(tokenId);
};

export const adminRevokeAccessToken = async (
  tokenId: number,
  repository: AccessTokenRepository = defaultAccessTokenRepository
): Promise<void> => {
  const existing = await repository.findById(tokenId);
  if (!existing) throw new NotFoundError('Token not found');
  await repository.revoke(tokenId);
};

/**
 * Verifica um token bruto (`ttpat_...`) e retorna o payload de auth equivalente ao JWT,
 * usado pelo authMiddleware para autenticar chamadas de ferramentas externas.
 */
export const verifyAccessToken = async (
  rawToken: string,
  repository: AccessTokenRepository = defaultAccessTokenRepository
): Promise<IAuthPayload | null> => {
  const tokenHash = hashToken(rawToken);
  const record = await repository.findActiveByHash(tokenHash);
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  const user = await userRepository.findUserById(record.userId);
  if (!user || !user.isActive || user.deletedAt) return null;
  let tokenGrants: Grant[] | undefined;
  if (record.grantsJson) {
    try {
      const parsed: unknown = JSON.parse(record.grantsJson);
      if (!Array.isArray(parsed) || !parsed.every(isGrant)) return null;
      tokenGrants = parsed;
    } catch { return null; }
  }

  void repository.touchLastUsed(record.id);

  return { userId: user.id, email: user.email, roleId: user.roleId, ...(tokenGrants ? { tokenGrants } : {}) };
};
