import api from '../../../../services/api';
import type { HistoryEntry, RetentionStatus } from '../types/adminRetention.types';

export async function fetchAdminRetentionStatus(): Promise<{
  status: RetentionStatus;
  history: HistoryEntry[];
  missingFields: boolean;
}> {
  const [statusRes, historyRes] = await Promise.all([
    api.get('/api/admin/retention/status'),
    api.get('/api/admin/retention/history?limit=10'),
  ]);

  const payload = statusRes.data.data || {};
  const missingFields = !payload.policy || !payload.statistics || !payload.pendingCleanup;
  const status: RetentionStatus = {
    policy: {
      auditLogsDays: payload.policy?.auditLogsDays ?? 0,
      expiredTokensDays: payload.policy?.expiredTokensDays ?? 0,
      revokedTokensDays: payload.policy?.revokedTokensDays ?? 0,
      unusedActivityTagsDays: payload.policy?.unusedActivityTagsDays ?? 0,
    },
    statistics: {
      totalAuditLogs: payload.statistics?.totalAuditLogs ?? 0,
      totalTokens: payload.statistics?.totalTokens ?? 0,
      totalActivityTags: payload.statistics?.totalActivityTags ?? 0,
    },
    pendingCleanup: {
      auditLogs: payload.pendingCleanup?.auditLogs ?? 0,
      expiredTokens: payload.pendingCleanup?.expiredTokens ?? 0,
      revokedTokens: payload.pendingCleanup?.revokedTokens ?? 0,
      activityTags: payload.pendingCleanup?.activityTags ?? 0,
      total: payload.pendingCleanup?.total ?? 0,
    },
    lastCleanup: payload.lastCleanup ?? null,
  };

  return { status, history: historyRes.data.data, missingFields };
}

export async function executeRetentionCleanup(): Promise<{
  totalDeleted: number;
  results: RetentionStatus['pendingCleanup'];
}> {
  const response = await api.post('/api/admin/retention/cleanup');
  return response.data.data;
}
