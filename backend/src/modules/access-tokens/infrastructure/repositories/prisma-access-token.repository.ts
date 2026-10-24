import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type { AccessTokenRepository } from '../../domain/repositories/access-token.repository.js';
import type { IAccessToken, IAccessTokenWithOwner } from '../../domain/access-token.types.js';

export class PrismaAccessTokenRepository implements AccessTokenRepository {
  async create(
    userId: number,
    label: string,
    tokenHash: string,
    expiresAt: Date,
    grantsJson?: string
  ): Promise<IAccessToken> {
    return prisma.personalAccessToken.create({
      data: { userId, label, tokenHash, expiresAt, grantsJson },
    });
  }

  async findActiveByHash(tokenHash: string): Promise<IAccessToken | null> {
    return prisma.personalAccessToken.findUnique({ where: { tokenHash } });
  }

  async listByUser(userId: number): Promise<IAccessToken[]> {
    return prisma.personalAccessToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll(): Promise<IAccessTokenWithOwner[]> {
    const rows = await prisma.personalAccessToken.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      label: row.label,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      ownerName: row.user.name,
      ownerEmail: row.user.email,
    }));
  }

  async findById(id: number): Promise<IAccessToken | null> {
    return prisma.personalAccessToken.findUnique({ where: { id } });
  }

  async revoke(id: number): Promise<void> {
    await prisma.personalAccessToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async touchLastUsed(id: number): Promise<void> {
    await prisma.personalAccessToken.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }
}

export const accessTokenRepository = new PrismaAccessTokenRepository();
