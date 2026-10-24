import { getClosingPeriodRangeUTC, getWorkingDaysInMonth, normalizeDateOnly } from '../date.js';
import { addDaysUTC } from '../../../services/date/utc-date.service.js';
import { closingEligibleMinutes } from '../duration-contract.js';

export interface CycleWindow {
  startDate: Date;
  endDate: Date;
}

export interface CycleMetrics {
  startDate: string;
  endDate: string;
  workedMinutes: number;
  targetMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
  isClosed: boolean;
}

export interface ClientCycleSummary {
  clientId: number;
  clientName: string;
  lockDay: number;
  closedCycle: CycleMetrics;
  nextCyclePreview: CycleMetrics;
}

export interface CycleTotals {
  workedMinutes: number;
  targetMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
}

export interface CycleSummaryResult {
  byClient: ClientCycleSummary[];
  totals: {
    closedCycle: CycleTotals;
    nextCyclePreview: CycleTotals;
  };
}

export interface CycleClientLike {
  id: number;
  name: string;
  lockDay: number | null;
}

export interface CycleEntryLike {
  clientId: number;
  durationMinutes: number;
  estimatedDurationMinutes?: number | null;
  confirmedDurationMinutes?: number | null;
  actualTrackedDurationMinutes?: number | null;
  date: Date;
}

export interface CycleAllocationLike {
  userId?: number;
  clientId: number;
  allocationType: 'DAILY' | 'MONTHLY';
  hoursPerDay: number | null;
  hoursPerMonth: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface ComputeCycleSummaryInput {
  year: number;
  month: number;
  clients: CycleClientLike[];
  entries: CycleEntryLike[];
  allocations: CycleAllocationLike[];
}

const formatDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate()
  ).padStart(2, '0')}`;

const mergeTotals = (target: CycleTotals, source: CycleTotals): void => {
  target.workedMinutes += source.workedMinutes;
  target.targetMinutes += source.targetMinutes;
  target.normalMinutes += source.normalMinutes;
  target.overtimeMinutes += source.overtimeMinutes;
};

const computeTargetForDate = (
  allocation: CycleAllocationLike | null,
  date: Date,
  monthWorkingDaysCache: Map<string, number>
): number => {
  if (!allocation) return 0;
  const weekDay = date.getUTCDay();
  if (weekDay === 0 || weekDay === 6) return 0;

  if (allocation.allocationType === 'DAILY') {
    return Math.round((allocation.hoursPerDay ?? 0) * 60);
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const key = `${year}-${month}`;
  const workingDays = monthWorkingDaysCache.get(key) ?? getWorkingDaysInMonth(year, month);
  monthWorkingDaysCache.set(key, workingDays);
  if (!workingDays) return 0;

  return ((allocation.hoursPerMonth ?? 0) * 60) / workingDays;
};

const findAllocationForDate = (
  allocations: CycleAllocationLike[],
  date: Date
): CycleAllocationLike | null => {
  const timestamp = date.getTime();
  for (let index = allocations.length - 1; index >= 0; index -= 1) {
    const allocation = allocations[index];
    if (!allocation?.effectiveFrom) continue;
    const start = normalizeDateOnly(allocation.effectiveFrom).getTime();
    const end = allocation.effectiveTo
      ? normalizeDateOnly(allocation.effectiveTo).getTime()
      : Number.POSITIVE_INFINITY;
    if (timestamp >= start && timestamp <= end) {
      return allocation;
    }
  }
  return null;
};

const computeCycleMetrics = (
  entries: CycleEntryLike[],
  allocations: CycleAllocationLike[],
  window: CycleWindow,
  isClosed: boolean
): CycleMetrics => {
  const start = normalizeDateOnly(window.startDate);
  const end = normalizeDateOnly(window.endDate);
  const workedMinutes = entries
    .filter((entry) => {
      const date = normalizeDateOnly(entry.date).getTime();
      return date >= start.getTime() && date <= end.getTime();
    })
    .reduce((sum, entry) => sum + closingEligibleMinutes(entry), 0);

  if (start.getTime() > end.getTime()) {
    return {
      startDate: formatDate(start),
      endDate: formatDate(end),
      workedMinutes,
      targetMinutes: 0,
      normalMinutes: 0,
      overtimeMinutes: workedMinutes,
      isClosed,
    };
  }

  let targetMinutes = 0;
  const monthWorkingDaysCache = new Map<string, number>();
  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor = addDaysUTC(cursor, 1)
  ) {
    const allocation = findAllocationForDate(allocations, cursor);
    targetMinutes += computeTargetForDate(allocation, cursor, monthWorkingDaysCache);
  }

  targetMinutes = Math.round(targetMinutes);
  const hasAllocation = targetMinutes > 0;
  const normalMinutes = hasAllocation ? Math.min(workedMinutes, targetMinutes) : 0;
  const overtimeMinutes = hasAllocation
    ? Math.max(0, workedMinutes - targetMinutes)
    : workedMinutes;

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
    workedMinutes,
    targetMinutes,
    normalMinutes,
    overtimeMinutes,
    isClosed,
  };
};

export const computeCycleSummaryForUser = (
  params: ComputeCycleSummaryInput
): CycleSummaryResult => {
  if (params.clients.length === 0) {
    return {
      byClient: [],
      totals: {
        closedCycle: { workedMinutes: 0, targetMinutes: 0, normalMinutes: 0, overtimeMinutes: 0 },
        nextCyclePreview: {
          workedMinutes: 0,
          targetMinutes: 0,
          normalMinutes: 0,
          overtimeMinutes: 0,
        },
      },
    };
  }

  const windowsByClient = new Map<
    number,
    { closedCycle: CycleWindow; nextCyclePreview: CycleWindow }
  >();
  let minStart: Date | null = null;
  let maxEnd: Date | null = null;

  params.clients.forEach((client) => {
    const { start: closedStart, end: closedEnd } = getClosingPeriodRangeUTC(
      params.year,
      params.month,
      client.lockDay ?? 31
    );
    const previewStart = addDaysUTC(closedEnd, 1);
    const previewEnd = new Date(Date.UTC(params.year, params.month, 0));
    const windows = {
      closedCycle: { startDate: closedStart, endDate: closedEnd },
      nextCyclePreview: {
        startDate: previewStart,
        endDate: previewStart.getTime() <= previewEnd.getTime() ? previewEnd : previewStart,
      },
    };
    windowsByClient.set(client.id, windows);
    minStart =
      !minStart || windows.closedCycle.startDate < minStart
        ? windows.closedCycle.startDate
        : minStart;
    maxEnd =
      !maxEnd || windows.nextCyclePreview.endDate > maxEnd
        ? windows.nextCyclePreview.endDate
        : maxEnd;
  });

  if (!minStart || !maxEnd) {
    return {
      byClient: [],
      totals: {
        closedCycle: { workedMinutes: 0, targetMinutes: 0, normalMinutes: 0, overtimeMinutes: 0 },
        nextCyclePreview: {
          workedMinutes: 0,
          targetMinutes: 0,
          normalMinutes: 0,
          overtimeMinutes: 0,
        },
      },
    };
  }

  const entriesByClient = new Map<number, CycleEntryLike[]>();
  params.entries.forEach((entry) => {
    const list = entriesByClient.get(entry.clientId) ?? [];
    list.push(entry);
    entriesByClient.set(entry.clientId, list);
  });

  const historyByClient = new Map<number, CycleAllocationLike[]>();
  params.allocations.forEach((allocation) => {
    const list = historyByClient.get(allocation.clientId) ?? [];
    list.push(allocation);
    historyByClient.set(allocation.clientId, list);
  });

  const totals = {
    closedCycle: { workedMinutes: 0, targetMinutes: 0, normalMinutes: 0, overtimeMinutes: 0 },
    nextCyclePreview: { workedMinutes: 0, targetMinutes: 0, normalMinutes: 0, overtimeMinutes: 0 },
  };

  const byClient = params.clients.map((client) => {
    const windows = windowsByClient.get(client.id)!;
    const entriesForClient = entriesByClient.get(client.id) ?? [];
    const allocationsForClient = historyByClient.get(client.id) ?? [];

    const closedCycle = computeCycleMetrics(
      entriesForClient,
      allocationsForClient,
      windows.closedCycle,
      true
    );
    const nextCyclePreview = computeCycleMetrics(
      entriesForClient,
      allocationsForClient,
      windows.nextCyclePreview,
      false
    );

    mergeTotals(totals.closedCycle, {
      workedMinutes: closedCycle.workedMinutes,
      targetMinutes: closedCycle.targetMinutes,
      normalMinutes: closedCycle.normalMinutes,
      overtimeMinutes: closedCycle.overtimeMinutes,
    });
    mergeTotals(totals.nextCyclePreview, {
      workedMinutes: nextCyclePreview.workedMinutes,
      targetMinutes: nextCyclePreview.targetMinutes,
      normalMinutes: nextCyclePreview.normalMinutes,
      overtimeMinutes: nextCyclePreview.overtimeMinutes,
    });

    return {
      clientId: client.id,
      clientName: client.name,
      lockDay: client.lockDay ? Math.max(1, Math.min(31, Math.round(client.lockDay))) : 31,
      closedCycle,
      nextCyclePreview,
    };
  });

  return { byClient, totals };
};
