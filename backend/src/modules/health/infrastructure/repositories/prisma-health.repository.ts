import type { PrismaClient } from '@prisma/client';
import type {
  HealthRecentError,
  HealthRepository,
} from '../../domain/repositories/health.repository.js';

export class PrismaHealthRepository implements HealthRepository {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      '$queryRaw' | 'user' | 'client' | 'timeEntry' | 'auditLog'
    >
  ) {}

  async ping(): Promise<number> {
    const startedAt = Date.now();
    await this.db.$queryRaw`SELECT 1`;
    return Date.now() - startedAt;
  }

  countUsers(filter?: { activeOnly?: boolean; lockedOnly?: boolean }): Promise<number> {
    return this.db.user.count({
      where: {
        deletedAt: null,
        ...(filter?.activeOnly ? { isActive: true } : {}),
        ...(filter?.lockedOnly ? { lockedUntil: { gt: new Date() } } : {}),
      },
    });
  }

  countClients(filter?: { activeOnly?: boolean }): Promise<number> {
    return this.db.client.count({
      where: {
        deletedAt: null,
        ...(filter?.activeOnly ? { isActive: true } : {}),
      },
    });
  }

  countTimeEntriesCreatedSince(date: Date): Promise<number> {
    return this.db.timeEntry.count({ where: { createdAt: { gte: date } } });
  }

  countTimeEntries(): Promise<number> {
    return this.db.timeEntry.count();
  }

  countAuditLogsCreatedSince(date: Date): Promise<number> {
    return this.db.auditLog.count({ where: { createdAt: { gte: date } } });
  }

  countFailedAuditLogsCreatedSince(date: Date): Promise<number> {
    return this.db.auditLog.count({
      where: { status: { in: ['ERROR', 'FAILURE', 'FAILED'] }, createdAt: { gte: date } },
    });
  }

  async findRecentFailedAuditLogs(date: Date, limit: number): Promise<HealthRecentError[]> {
    const rows = await this.db.auditLog.findMany({
      where: { status: { in: ['ERROR', 'FAILURE', 'FAILED'] }, createdAt: { gte: date } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { createdAt: true, endpoint: true, action: true, details: true },
    });
    return rows.map((row) => ({
      timestamp: row.createdAt.toISOString(),
      endpoint: row.endpoint,
      action: row.action,
      details: row.details,
    }));
  }
}
