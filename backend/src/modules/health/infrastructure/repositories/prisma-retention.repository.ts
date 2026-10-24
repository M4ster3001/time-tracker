import type { PrismaClient } from '@prisma/client';
import type {
  RetentionCleanupResult,
  RetentionRepository,
} from '../../domain/repositories/retention.repository.js';

export class PrismaRetentionRepository implements RetentionRepository {
  constructor(
    private readonly db: Pick<PrismaClient, 'auditLog' | 'refreshToken' | 'activityTag'>
  ) {}

  async deleteAuditLogsOlderThan(date: Date): Promise<number> {
    const result = await this.db.auditLog.deleteMany({ where: { createdAt: { lt: date } } });
    return result.count;
  }

  async deleteExpiredRefreshTokensOlderThan(date: Date): Promise<number> {
    const result = await this.db.refreshToken.deleteMany({ where: { expiresAt: { lt: date } } });
    return result.count;
  }

  async deleteRevokedRefreshTokensOlderThan(date: Date): Promise<number> {
    const result = await this.db.refreshToken.deleteMany({
      where: { revokedAt: { not: null, lt: date } },
    });
    return result.count;
  }

  async deleteUnusedActivityTagsOlderThan(date: Date): Promise<number> {
    const result = await this.db.activityTag.deleteMany({
      where: { usageCount: 0, lastUsedAt: { lt: date } },
    });
    return result.count;
  }

  countAuditLogsOlderThan(date: Date): Promise<number> {
    return this.db.auditLog.count({ where: { createdAt: { lt: date } } });
  }

  countAuditLogs(): Promise<number> {
    return this.db.auditLog.count();
  }

  countRefreshTokens(): Promise<number> {
    return this.db.refreshToken.count();
  }

  countExpiredRefreshTokens(date: Date): Promise<number> {
    return this.db.refreshToken.count({ where: { expiresAt: { lt: date } } });
  }

  countRevokedRefreshTokens(): Promise<number> {
    return this.db.refreshToken.count({ where: { revokedAt: { not: null } } });
  }

  countRevokedRefreshTokensOlderThan(date: Date): Promise<number> {
    return this.db.refreshToken.count({ where: { revokedAt: { not: null, lt: date } } });
  }

  countUnusedActivityTagsOlderThan(date: Date): Promise<number> {
    return this.db.activityTag.count({ where: { usageCount: 0, lastUsedAt: { lt: date } } });
  }

  findLastCleanup(): Promise<{ createdAt: Date; details: string | null } | null> {
    return this.db.auditLog.findFirst({
      where: { action: 'DATA_RETENTION_CLEANUP' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, details: true },
    });
  }

  findCleanupHistory(limit: number): Promise<
    Array<{
      id: number;
      action: string;
      status: string;
      details: string | null;
      createdAt: Date;
      user?: { name: string } | null;
    }>
  > {
    return this.db.auditLog.findMany({
      where: { action: { in: ['DATA_RETENTION_CLEANUP', 'MANUAL_DATA_RETENTION_TRIGGER'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        status: true,
        details: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });
  }

  async logCleanup(results: RetentionCleanupResult): Promise<void> {
    await this.db.auditLog.create({
      data: {
        userId: null,
        endpoint: '/system/data-retention',
        action: 'DATA_RETENTION_CLEANUP',
        status: 'success',
        details: JSON.stringify(results),
      },
    });
  }

  async logManualTrigger(userId: number): Promise<void> {
    await this.db.auditLog.create({
      data: {
        userId,
        endpoint: '/api/admin/retention/cleanup',
        action: 'MANUAL_DATA_RETENTION_TRIGGER',
        status: 'INITIATED',
        details: JSON.stringify({ triggeredBy: userId }),
      },
    });
  }
}
