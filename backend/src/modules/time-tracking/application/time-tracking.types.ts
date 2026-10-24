import type { ITimeEntry } from '../domain/time-entry.types.js';

export interface SupervisedTimeEntryFilters {
  actorUserId: number;
  actorRoleId: number;
  userId?: number;
  clientId?: number;
  startDate?: Date;
  endDate?: Date;
  page: number;
  limit: number;
}

export interface SupervisedTimeEntryItem extends ITimeEntry {
  user: {
    id: number;
    name: string;
    email: string;
    roleId: number;
  };
  client: {
    id: number;
    name: string;
    lockDay: number | null;
  };
  locked: boolean;
}

export interface MonthSummary {
  totalMinutes: number;
  totalHours: number;
  byClient: Array<{
    clientId: number;
    clientName: string;
    paysOvertime: boolean;
    minutes: number;
  }>;
}
