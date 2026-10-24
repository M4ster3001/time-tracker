import type { ITimeEntry } from '../../domain/time-entry.types.js';
import { getTimeEntryById, type TimeTrackingServiceDeps } from '../time-tracking.service.js';

export const executeGetTimeEntry = (
  id: number,
  userId: number,
  callerRoleId?: number,
  deps?: TimeTrackingServiceDeps
): Promise<ITimeEntry> => getTimeEntryById(id, userId, callerRoleId, deps);
