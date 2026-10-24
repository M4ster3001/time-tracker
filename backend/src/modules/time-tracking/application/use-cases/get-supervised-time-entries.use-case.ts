import type {
  SupervisedTimeEntryFilters,
  SupervisedTimeEntryItem,
} from '../time-tracking.types.js';
import {
  getSupervisedTimeEntries,
  type TimeTrackingServiceDeps,
} from '../time-tracking.service.js';

export const executeGetSupervisedTimeEntries = (
  filters: SupervisedTimeEntryFilters,
  deps?: TimeTrackingServiceDeps
): Promise<{ items: SupervisedTimeEntryItem[]; total: number; page: number; limit: number }> =>
  getSupervisedTimeEntries(filters, deps);
