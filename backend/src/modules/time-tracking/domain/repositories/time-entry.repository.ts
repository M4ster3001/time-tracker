import type { ITimeEntry, TimeEntrySource } from '../time-entry.types.js';

export interface TimeEntryUserSnapshot {
  id: number;
  name: string;
  email: string;
  roleId: number;
}

export interface TimeEntryClientSnapshot {
  id: number;
  name: string;
  lockDay: number | null;
  paysOvertime?: boolean;
  requireProjectOnEntries?: boolean;
}

export interface SupervisedTimeEntryRow extends ITimeEntry {
  user: TimeEntryUserSnapshot;
  client: TimeEntryClientSnapshot;
}

export interface SupervisedManagerEntryQuery {
  actorUserId: number;
  userId?: number;
  clientId?: number;
  startDate?: Date;
  endDate?: Date;
  page: number;
  limit: number;
}

export interface SupervisedAdminEntryQuery {
  roleIds: number[];
  userId?: number;
  clientId?: number;
  startDate?: Date;
  endDate?: Date;
  page: number;
  limit: number;
}

export interface TimeEntryRepository {
  findClientLockDay(clientId: number): Promise<number | null>;
  hasUserClientLink(userId: number, clientId: number): Promise<boolean>;
  findUserClientLinks(userId: number, clientIds: number[]): Promise<number[]>;
  findTimeEntryById(id: number): Promise<ITimeEntry | null>;
  findManagedEntryAccess(entryUserId: number, managerId: number): Promise<boolean>;
  createTimeEntry(data: {
    userId: number;
    clientId: number;
    date: Date;
    activityDescription: string;
    durationMinutes: number;
    projectId?: number | null;
    source?: TimeEntrySource;
    uuid?: string;
  }): Promise<ITimeEntry>;
  findTimeEntriesByUser(userId: number): Promise<ITimeEntry[]>;
  findTimeEntriesByUserAndMonth(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ITimeEntry[]>;
  findTimeEntriesByUserAndClient(userId: number, clientId: number): Promise<ITimeEntry[]>;
  findTimeEntriesByUserAndClientAndMonth(
    userId: number,
    clientId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ITimeEntry[]>;
  sumUserDayMinutes(userId: number, date: Date): Promise<number>;
  sumUserDayMinutesExcludingEntry(userId: number, date: Date, entryId: number): Promise<number>;
  updateTimeEntry(
    id: number,
    data: Partial<{
      clientId: number;
      date: Date;
      activityDescription: string;
      durationMinutes: number;
      projectId: number | null;
    }>,
    dailyLimit?: { userId: number; date: Date; durationMinutes: number;
      previousClientId: number; previousDate: Date; expectedUpdatedAt: Date }
  ): Promise<ITimeEntry>;
  deleteTimeEntry(id: number): Promise<void>;
  createBulkTimeEntries(
    userId: number,
    entries: Array<{
      clientId: number;
      date: Date;
      activityDescription: string;
      durationMinutes: number;
      projectId?: number | null;
    }>,
    source?: TimeEntrySource
  ): Promise<ITimeEntry[]>;
  aggregateMonthMinutes(userId: number, startDate: Date, endDate: Date): Promise<number>;
  aggregateClientMonthMinutes(
    userId: number,
    clientId: number,
    startDate: Date,
    endDate: Date
  ): Promise<number>;
  groupMonthMinutesByClient(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ clientId: number; minutes: number }>>;
  findClientsByIds(ids: number[]): Promise<TimeEntryClientSnapshot[]>;
  createAuditLog(data: {
    userId: number | null;
    endpoint: string;
    action: string;
    status: string;
    details: string | null;
  }): Promise<void>;
  findAllowedSupervisedUser(userId: number, roleIds: number[]): Promise<{ id: number } | null>;
  queryManagerSupervisedEntryIds(
    params: SupervisedManagerEntryQuery
  ): Promise<{ ids: number[]; total: number }>;
  findEntriesWithRelationsByIds(ids: number[]): Promise<SupervisedTimeEntryRow[]>;
  findSupervisedEntriesForAdmin(
    params: SupervisedAdminEntryQuery
  ): Promise<{ rows: SupervisedTimeEntryRow[]; total: number }>;
  findManagedConsultants(
    managerId: number
  ): Promise<Array<{ id: number; name: string; email: string }>>;
}
