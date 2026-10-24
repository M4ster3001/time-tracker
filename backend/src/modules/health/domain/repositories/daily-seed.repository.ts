export interface DailySeedRepository {
  findSeedRun(key: string): Promise<{ key: string; lastRunDate: Date } | null>;
  upsertSeedRun(key: string, lastRunDate: Date): Promise<void>;
  findActiveConsultants(): Promise<Array<{ id: number }>>;
  findUsersForLogs(): Promise<Array<{ id: number; roleId: number }>>;
  findTimeEntriesInRange(start: Date, end: Date): Promise<Array<{ userId: number; date: Date }>>;
  createTimeEntries(
    entries: Array<{
      userId: number;
      clientId: number;
      date: Date;
      activityDescription: string;
      durationMinutes: number;
    }>
  ): Promise<void>;
  findAllClientsByActive(isActive: boolean): Promise<Array<{ id: number }>>;
  updateClientActive(clientId: number, isActive: boolean): Promise<void>;
  createClient(): Promise<{ id: number }>;
  findConsultantsByActive(isActive: boolean): Promise<Array<{ id: number }>>;
  updateUserActive(userId: number, isActive: boolean): Promise<void>;
  findActiveManagers(): Promise<Array<{ id: number }>>;
  createConsultant(data: {
    name: string;
    email: string;
    passwordHash: string;
    managerId: number | null;
  }): Promise<{ id: number }>;
  findUserClientLinks(
    userIds: number[],
    clientIds: number[]
  ): Promise<Array<{ userId: number; clientId: number }>>;
  findUserClientIds(userId: number): Promise<number[]>;
  unlinkClient(userId: number, clientId: number): Promise<void>;
  linkClient(userId: number, clientId: number): Promise<void>;
  createAuditLogs(
    logs: Array<{
      userId: number | null;
      endpoint: string;
      action: string;
      status: string;
      details: string;
    }>
  ): Promise<void>;
}
