export {
  createTimeEntry,
  getTimeEntriesByUser,
  getTimeEntriesByMonth,
  getTimeEntriesByClient,
  getTimeEntriesByClientAndMonth,
  getTimeEntryById,
  getTotalHoursByMonth,
  getMonthSummary,
  getTotalHoursByClientAndMonth,
  createBulkTimeEntries,
  updateTimeEntry,
  deleteTimeEntry,
  getTimeEntriesByManagedConsultants,
  getSupervisedTimeEntries,
  TimeTrackingService,
  type TimeTrackingServiceDeps,
} from '../modules/time-tracking/application/time-tracking.service.js';

export type {
  SupervisedTimeEntryFilters,
  SupervisedTimeEntryItem,
  MonthSummary,
} from '../modules/time-tracking/application/time-tracking.types.js';
