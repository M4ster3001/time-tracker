import type { MonthSummary } from '../time-tracking.types.js';
import { getMonthSummary, type TimeTrackingServiceDeps } from '../time-tracking.service.js';

export const executeGetMonthSummary = (
  userId: number,
  year: number,
  month: number,
  deps?: TimeTrackingServiceDeps
): Promise<MonthSummary> => getMonthSummary(userId, year, month, deps);
