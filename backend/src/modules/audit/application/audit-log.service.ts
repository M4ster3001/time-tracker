import type { IAuditLog } from '../domain/audit-log.types.js';
import type { AuditLogFilters, AuditLogRepository } from '../domain/repositories/audit-log.repository.js';
import { auditLogRepository as defaultRepository } from '../infrastructure/repositories/prisma-audit-log.repository.js';

export const listAuditLogs = async (
  filters: AuditLogFilters,
  repository: AuditLogRepository = defaultRepository
): Promise<IAuditLog[]> => repository.findMany(filters);
