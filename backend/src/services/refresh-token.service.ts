import {
  refreshTokenRepository,
  type PrismaRefreshTokenRepository,
} from '../modules/auth/infrastructure/repositories/prisma-refresh-token.repository.js';
import type { RefreshTokenMetadata } from '../modules/auth/domain/repositories/refresh-token.repository.js';

export {
  refreshTokenRepository,
  refreshTokenRepository as refreshTokenService,
} from '../modules/auth/infrastructure/repositories/prisma-refresh-token.repository.js';

export type { PrismaRefreshTokenRepository };
export type { RefreshTokenMetadata };

export const createRefreshToken = (userId: number, metadata?: RefreshTokenMetadata) =>
  refreshTokenRepository.create(userId, metadata);

export const rotateRefreshToken = (token: string, metadata?: RefreshTokenMetadata) =>
  refreshTokenRepository.rotate(token, metadata);

export const revokeRefreshToken = (token: string) => refreshTokenRepository.revoke(token);

export const revokeUserRefreshTokens = (userId: number) =>
  refreshTokenRepository.revokeUserSessions(userId);
