import type { ITimeEntry, TimeEntrySource } from '../../domain/time-entry.types.js';
import { createBulkTimeEntries, type TimeTrackingServiceDeps } from '../time-tracking.service.js';

export const executeCreateBulkTimeEntries = (
  userId: number,
  entries: Array<{
    clientId: number;
    date: Date;
    activityDescription: string;
    durationMinutes: number;
  }>,
  source?: TimeEntrySource,
  deps?: TimeTrackingServiceDeps
): Promise<ITimeEntry[]> => createBulkTimeEntries(userId, entries, source, deps);
