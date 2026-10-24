import type { ITimeEntry } from '../../domain/time-entry.types.js';
import { updateTimeEntry, type TimeTrackingServiceDeps } from '../time-tracking.service.js';

export const executeUpdateTimeEntry = (
  id: number,
  userId: number,
  data: { clientId?: number; date?: Date; activityDescription?: string; durationMinutes?: number },
  callerRoleId?: number,
  deps?: TimeTrackingServiceDeps
): Promise<ITimeEntry> => updateTimeEntry(id, userId, data, callerRoleId, deps);
