export interface ClosingCycleClient {
  id: number;
  name: string;
  lockDay: number | null;
}

export interface ClosingCycleTimeEntry {
  clientId: number;
  durationMinutes: number;
  date: Date;
}

export interface ClosingCycleTimeEntryForUser extends ClosingCycleTimeEntry {
  userId: number;
}

export interface UserClientLink {
  userId: number;
  clientId: number;
}

export interface AllocationHistoryRow {
  userId: number;
  clientId: number;
  allocationType: 'DAILY' | 'MONTHLY';
  hoursPerDay: number | null;
  hoursPerMonth: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface AllocationSnapshotRow {
  userId: number;
  clientId: number;
  allocationType: 'DAILY' | 'MONTHLY';
  hoursPerDay: number | null;
  hoursPerMonth: number | null;
}

export interface ClosingCycleRepository {
  findClientIdsLinkedToUser(userId: number): Promise<number[]>;

  findClientIdsLinkedToUsers(userIds: number[]): Promise<UserClientLink[]>;

  findClientIdsWithTimeEntriesInRange(userId: number, start: Date, end: Date): Promise<number[]>;

  findClientIdsWithTimeEntriesInRangeForUsers(
    userIds: number[],
    start: Date,
    end: Date
  ): Promise<UserClientLink[]>;

  findClientsByIds(clientIds: number[]): Promise<ClosingCycleClient[]>;

  findTimeEntriesInRange(
    userId: number,
    clientIds: number[],
    start: Date,
    end: Date
  ): Promise<ClosingCycleTimeEntry[]>;

  findTimeEntriesInRangeForUsers(
    userIds: number[],
    clientIds: number[],
    start: Date,
    end: Date
  ): Promise<ClosingCycleTimeEntryForUser[]>;

  /** Retorna as linhas cruas de historico (sem normalizar defaults) — a normalizacao e a
   * decisao de usar o snapshot como fallback pertencem a application/, nao a infrastructure/. */
  findAllocationHistoryInRange(params: {
    userId: number;
    clientIds: number[];
    minStart: Date;
    maxEnd: Date;
  }): Promise<Array<Partial<AllocationHistoryRow>>>;

  findAllocationHistoryInRangeForUsers(params: {
    userIds: number[];
    clientIds: number[];
    minStart: Date;
    maxEnd: Date;
  }): Promise<Array<Partial<AllocationHistoryRow>>>;

  findCurrentAllocationSnapshot(
    userId: number,
    clientIds: number[]
  ): Promise<AllocationSnapshotRow[]>;

  findCurrentAllocationSnapshotsForUsers(
    userIds: number[],
    clientIds: number[]
  ): Promise<AllocationSnapshotRow[]>;
}
