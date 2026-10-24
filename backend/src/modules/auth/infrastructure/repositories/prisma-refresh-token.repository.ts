import crypto from 'crypto';
import { config } from '../../../../config.js';
import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type {
  RefreshTokenMetadata,
  RefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository.js';

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const hashValue = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

const hashUserAgent = (userAgent: string | null | undefined): string | null => {
  if (!userAgent) return null;
  return hashValue(userAgent);
};

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  async create(userId: number, metadata?: RefreshTokenMetadata): Promise<{ token: string }> {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.refresh.ttlDays * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        userAgent: hashUserAgent(metadata?.userAgent),
        ipHash: metadata?.ip ? hashValue(metadata.ip) : null,
        deviceLabel: metadata?.deviceLabel ?? null,
        expiresAt,
      },
    });

    return { token };
  }

  async rotate(
    token: string,
    metadata?: RefreshTokenMetadata
  ): Promise<{ userId: number; newToken: string } | null> {
    const tokenHash = hashToken(token);
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (existing?.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      return null;
    }

    const newToken = crypto.randomBytes(64).toString('hex');
    const newTokenHash = hashToken(newToken);
    const newExpiresAt = new Date(Date.now() + config.refresh.ttlDays * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { tokenHash },
        data: {
          revokedAt: new Date(),
          replacedByHash: newTokenHash,
        },
      }),
      prisma.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: newTokenHash,
          userAgent: metadata?.userAgent
            ? hashUserAgent(metadata.userAgent)
            : (existing.userAgent ?? null),
          ipHash: metadata?.ip ? hashValue(metadata.ip) : (existing.ipHash ?? null),
          deviceLabel: metadata?.deviceLabel ?? existing.deviceLabel ?? null,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    return { userId: existing.userId, newToken };
  }

  async revoke(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeUserSessions(userId: number): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export const refreshTokenRepository = new PrismaRefreshTokenRepository();
