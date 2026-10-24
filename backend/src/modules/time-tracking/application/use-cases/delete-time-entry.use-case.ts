import { deleteTimeEntry, type TimeTrackingServiceDeps } from '../time-tracking.service.js';

export const executeDeleteTimeEntry = (
  id: number,
  userId: number,
  callerRoleId?: number,
  deps?: TimeTrackingServiceDeps
): Promise<void> => deleteTimeEntry(id, userId, callerRoleId, deps);
