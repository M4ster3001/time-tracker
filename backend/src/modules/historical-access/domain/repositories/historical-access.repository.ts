export interface AssignmentWindow {
  startDate: Date;
  endDate: Date | null;
}

export interface HistoricalAccessRepository {
  findCurrentManagedConsultantIds(managerId: number): Promise<number[]>;

  findHistoricalManagedConsultantIds(
    managerId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<number[]>;

  findCurrentManagerLink(managerId: number, consultantId: number): Promise<{ id: number } | null>;

  findHistoricalAssignmentWindows(
    managerId: number,
    consultantId: number,
    date: Date
  ): Promise<AssignmentWindow[]>;

  findOpenAssignment(
    managerId: number,
    consultantId: number
  ): Promise<{ id: number; startDate: Date } | null>;

  closeAssignment(id: number, endDate: Date): Promise<void>;

  createAssignment(managerId: number, consultantId: number, startDate: Date): Promise<void>;

  findLinkedClientIds(userId: number, candidateClientIds?: number[]): Promise<number[]>;

  findLinkedClientIdsForUsers(userIds: number[], candidateClientIds?: number[]): Promise<number[]>;

  findClientIdsWithTimeEntries(userId: number, candidateClientIds?: number[]): Promise<number[]>;

  findClientIdsWithTimeEntriesForUsers(
    userIds: number[],
    candidateClientIds?: number[]
  ): Promise<number[]>;

  findClientLink(userId: number, clientId: number): Promise<{ userId: number } | null>;

  findAnyTimeEntry(userId: number, clientId: number): Promise<{ id: number } | null>;
}
