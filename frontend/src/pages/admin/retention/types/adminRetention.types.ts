export interface RetentionPolicy {
  auditLogsDays: number;
  expiredTokensDays: number;
  revokedTokensDays: number;
  unusedActivityTagsDays: number;
}

export interface RetentionStats {
  totalAuditLogs: number;
  totalTokens: number;
  totalActivityTags: number;
}

export interface PendingCleanup {
  auditLogs: number;
  expiredTokens: number;
  revokedTokens: number;
  activityTags: number;
  total: number;
}

export interface LastCleanup {
  timestamp: string;
  results: {
    auditLogs: number;
    expiredTokens: number;
    revokedTokens: number;
    activityTags: number;
  } | null;
}

export interface RetentionStatus {
  policy: RetentionPolicy;
  statistics: RetentionStats;
  pendingCleanup: PendingCleanup;
  lastCleanup: LastCleanup | null;
}

export interface HistoryEntry {
  id: number;
  action: string;
  status: string;
  results: {
    auditLogs?: number;
    expiredTokens?: number;
    revokedTokens?: number;
    activityTags?: number;
    triggeredBy?: number;
  } | null;
  timestamp: string;
  triggeredBy: string;
}
