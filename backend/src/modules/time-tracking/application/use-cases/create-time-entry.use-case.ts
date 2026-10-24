import type { ITimeEntry } from '../../domain/time-entry.types.js';
import { createTimeEntry, type TimeTrackingServiceDeps } from '../time-tracking.service.js';

export const executeCreateTimeEntry = (
  data: {
    userId: number;
    clientId: number;
    date: Date;
    activityDescription: string;
    durationMinutes: number;
  },
  deps?: TimeTrackingServiceDeps
): Promise<ITimeEntry> => createTimeEntry(data, deps);
