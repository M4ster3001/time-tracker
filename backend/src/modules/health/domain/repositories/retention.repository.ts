export interface RetentionCleanupResult {
  auditLogs: number;
  expiredTokens: number;
  revokedTokens: number;
  activityTags: number;
}

export interface RetentionRepository {
  deleteAuditLogsOlderThan(date: Date): Promise<number>;
  deleteExpiredRefreshTokensOlderThan(date: Date): Promise<number>;
  deleteRevokedRefreshTokensOlderThan(date: Date): Promise<number>;
  deleteUnusedActivityTagsOlderThan(date: Date): Promise<number>;
  countAuditLogsOlderThan(date: Date): Promise<number>;
  countAuditLogs(): Promise<number>;
  countRefreshTokens(): Promise<number>;
  countExpiredRefreshTokens(date: Date): Promise<number>;
  countRevokedRefreshTokens(): Promise<number>;
  countRevokedRefreshTokensOlderThan(date: Date): Promise<number>;
  countUnusedActivityTagsOlderThan(date: Date): Promise<number>;
  findLastCleanup(): Promise<{ createdAt: Date; details: string | null } | null>;
  findCleanupHistory(limit: number): Promise<
    Array<{
      id: number;
      action: string;
      status: string;
      details: string | null;
      createdAt: Date;
      user?: { name: string } | null;
    }>
  >;
  logCleanup(results: RetentionCleanupResult): Promise<void>;
  logManualTrigger(userId: number): Promise<void>;
}
