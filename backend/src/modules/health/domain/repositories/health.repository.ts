export type HealthRecentError = {
  timestamp: string;
  endpoint: string;
  action: string;
  details: string | null;
};

export interface HealthRepository {
  ping(): Promise<number>;
  countUsers(filter?: { activeOnly?: boolean; lockedOnly?: boolean }): Promise<number>;
  countClients(filter?: { activeOnly?: boolean }): Promise<number>;
  countTimeEntriesCreatedSince(date: Date): Promise<number>;
  countTimeEntries(): Promise<number>;
  countAuditLogsCreatedSince(date: Date): Promise<number>;
  countFailedAuditLogsCreatedSince(date: Date): Promise<number>;
  findRecentFailedAuditLogs(date: Date, limit: number): Promise<HealthRecentError[]>;
}
