import type { ITimeEntry } from '../../domain/time-entry.types.js';
import {
  getTimeEntriesByMonth,
  getTimeEntriesByClientAndMonth,
  type TimeTrackingServiceDeps,
} from '../time-tracking.service.js';
import { assertListTimeEntriesBounded } from './list-time-entries.policy.js';

export const executeListTimeEntries = (
  params: { userId: number; month?: number; year?: number; clientId?: number },
  deps?: TimeTrackingServiceDeps
): Promise<ITimeEntry[]> => {
  assertListTimeEntriesBounded(params);
  if (params.clientId) {
    return getTimeEntriesByClientAndMonth(
      params.userId,
      params.clientId,
      params.year!,
      params.month!,
      deps
    );
  }
  return getTimeEntriesByMonth(params.userId, params.year!, params.month!, deps);
};
