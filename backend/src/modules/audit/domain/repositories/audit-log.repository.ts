import type { IAuditLog } from '../audit-log.types.js';

export interface AuditLogFilters {
  userId?: number;
  action?: string;
  limit?: number;
}

export interface AuditLogRepository {
  findMany(filters: AuditLogFilters): Promise<IAuditLog[]>;
}
