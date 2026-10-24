import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type { IAuditLog } from '../../domain/audit-log.types.js';
import type {
  AuditLogFilters,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository.js';

const parseAuditDetailsJson = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
};

export class PrismaAuditLogRepository implements AuditLogRepository {
  async findMany(filters: AuditLogFilters): Promise<IAuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.action ? { action: { contains: filters.action } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
    });

    return logs.map((log) => ({
      ...(log as IAuditLog),
      detailsJson: parseAuditDetailsJson((log as { detailsJson?: unknown }).detailsJson),
    }));
  }
}

export const auditLogRepository = new PrismaAuditLogRepository();
