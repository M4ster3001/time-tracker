import api from '../../../../services/api';
import type { AuditLogRow } from '../types/auditLogs.types';

export const fetchAuditLogs = async (userId?: string, action?: string) => {
  const response = await api.get('/api/audit-logs', {
    params: {
      userId: userId || undefined,
      action: action || undefined,
    },
  });

  return (response.data.data || []) as AuditLogRow[];
};
