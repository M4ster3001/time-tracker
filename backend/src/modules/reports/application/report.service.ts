import type { ReportAllocationType } from '../domain/repositories/report.repository.js';
import type {
  ClientCycleSummary,
  CycleSummaryResult,
} from '../../../shared/domain/policies/closing-cycle.policy.js';
import { computeCycleSummaryForUser } from '../../closing-cycle/application/closing-cycle.service.js';
import { reportRepository } from '../infrastructure/repositories/prisma-report.repository.js';
import type {
  ClientCapacity,
  ClientCapacityFilters,
  ConsultantPerformance,
  ConsultantPerformanceFilters,
} from './report.service.interfaces.js';
import type { AllocationWithRefs, EntryWithRefs, NullablePercent } from './report.service.types.js';

const toKey = (userId: number, clientId: number): string => `${userId}:${clientId}`;
const toHours = (minutes: number): number => minutes / 60;
const round2 = (value: number): number => Math.round(value * 100) / 100;
const toPercent = (workedHours: number, allocatedHours: number): NullablePercent =>
  allocatedHours > 0 ? Math.round((workedHours / allocatedHours) * 100) : null;

const isUserInBaseScope = (
  user: {
    id: number;
    roleId: number;
    managerId?: number | null;
    isActive?: boolean;
    deletedAt: Date | null;
  },
  filters: ConsultantPerformanceFilters
): boolean => {
  if (user.roleId !== 3 || user.deletedAt) return false;
  if (filters.userId && user.id !== filters.userId) return false;
  if (filters.managerId && user.managerId !== filters.managerId) return false;
  if (!filters.includeInactive && user.isActive === false) return false;
  return true;
};

const isUserInHistoricalScope = (
  user: { id: number; roleId: number; managerId?: number | null; deletedAt: Date | null },
  filters: ConsultantPerformanceFilters
): boolean => {
  if (user.roleId !== 3 || user.deletedAt) return false;
  if (filters.userId && user.id !== filters.userId) return false;
  if (filters.managerId && user.managerId !== filters.managerId) return false;
  return true;
};

const getAllocatedHoursFromAllocation = (
  allocation: AllocationWithRefs | undefined,
  workingDays: number,
  monthsInPeriod: number
): number => {
  if (!allocation) return 0;
  if (allocation.allocationType === 'DAILY' && allocation.hoursPerDay) {
    return round2(allocation.hoursPerDay * workingDays);
  }
  if (allocation.allocationType === 'MONTHLY' && allocation.hoursPerMonth) {
    return round2(allocation.hoursPerMonth * monthsInPeriod);
  }
  return 0;
};

const toReportHours = (minutes: number): number => round2(minutes / 60);

/**
 * ADM-01: Get performance report for consultants
 * Historical source of truth is time entries; allocation is optional metadata.
 */
export const getConsultantPerformanceReport = async (
  filters: ConsultantPerformanceFilters
): Promise<ConsultantPerformance[]> => {
  const { clientId, startDate, endDate } = filters;
  const workingDays = getWorkingDays(startDate, endDate);
  const monthsInPeriod = getMonthsInPeriod(startDate, endDate);

  const { baseConsultants, entries, allocations } =
    await reportRepository.getConsultantPerformanceData({ clientId, startDate, endDate });

  const relevantEntries = (entries as Array<EntryWithRefs>).filter((entry) =>
    isUserInHistoricalScope(entry.user, filters)
  );
  const relevantAllocations = (allocations as Array<AllocationWithRefs>).filter((allocation) =>
    isUserInHistoricalScope(allocation.user, filters)
  );

  const consultantMap = new Map<
    number,
    {
      id: number;
      name: string;
      email: string;
      managerId: number | null;
      managerName: string | null;
    }
  >();

  baseConsultants
    .filter((user) => isUserInBaseScope(user, filters))
    .forEach((user) => {
      consultantMap.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        managerId: user.managerId,
        managerName: user.manager?.name ?? null,
      });
    });

  relevantEntries.forEach((entry) => {
    consultantMap.set(entry.user.id, {
      id: entry.user.id,
      name: entry.user.name,
      email: entry.user.email,
      managerId: entry.user.managerId,
      managerName: entry.user.manager?.name ?? null,
    });
  });

  const entriesByUser = new Map<number, Array<EntryWithRefs>>();
  relevantEntries.forEach((entry) => {
    const list = entriesByUser.get(entry.userId) ?? [];
    list.push(entry);
    entriesByUser.set(entry.userId, list);
  });

  const allocationsByUserClient = new Map<string, AllocationWithRefs>();
  relevantAllocations.forEach((allocation) => {
    allocationsByUserClient.set(toKey(allocation.userId, allocation.clientId), allocation);
  });

  const results: ConsultantPerformance[] = [];
  const cycleYear = endDate.getUTCFullYear();
  const cycleMonth = endDate.getUTCMonth() + 1;
  const consultantIds = Array.from(consultantMap.keys());
  const cycleByConsultant = new Map<number, CycleSummaryResult>(
    await Promise.all(
      consultantIds.map(
        async (consultantId) =>
          [
            consultantId,
            await computeCycleSummaryForUser({
              userId: consultantId,
              year: cycleYear,
              month: cycleMonth,
            }),
          ] as const
      )
    )
  );

  for (const consultant of consultantMap.values()) {
    const consultantEntries = entriesByUser.get(consultant.id) ?? [];
    const pairMap = new Map<number, { clientId: number; clientName: string; clientCode: string }>();

    consultantEntries.forEach((entry) => {
      pairMap.set(entry.clientId, {
        clientId: entry.clientId,
        clientName: entry.client.name,
        clientCode: entry.client.code,
      });
    });

    relevantAllocations
      .filter((allocation) => allocation.userId === consultant.id)
      .forEach((allocation) => {
        pairMap.set(allocation.clientId, {
          clientId: allocation.clientId,
          clientName: allocation.client.name,
          clientCode: allocation.client.code,
        });
      });

    const cycleSummary = cycleByConsultant.get(consultant.id);

    const clientBreakdown = Array.from(pairMap.values())
      .map((client) => {
        const allocation = allocationsByUserClient.get(toKey(consultant.id, client.clientId));
        const allocatedHours = getAllocatedHoursFromAllocation(
          allocation,
          workingDays,
          monthsInPeriod
        );
        const workedHours = round2(
          toHours(
            consultantEntries
              .filter((entry) => entry.clientId === client.clientId)
              .reduce((sum, entry) => sum + entry.durationMinutes, 0)
          )
        );

        const cycleClient = cycleSummary?.byClient.find(
          (item: ClientCycleSummary) => item.clientId === client.clientId
        );

        return {
          clientId: client.clientId,
          clientName: client.clientName,
          clientCode: client.clientCode,
          allocatedHours,
          workedHours,
          utilizationPercent: toPercent(workedHours, allocatedHours),
          closedCycle: {
            startDate: cycleClient?.closedCycle.startDate ?? '',
            endDate: cycleClient?.closedCycle.endDate ?? '',
            workedHours: toReportHours(cycleClient?.closedCycle.workedMinutes ?? 0),
            allocatedHours: toReportHours(cycleClient?.closedCycle.targetMinutes ?? 0),
            overtimeHours: toReportHours(cycleClient?.closedCycle.overtimeMinutes ?? 0),
          },
          nextCyclePreview: {
            startDate: cycleClient?.nextCyclePreview.startDate ?? '',
            endDate: cycleClient?.nextCyclePreview.endDate ?? '',
            workedHours: toReportHours(cycleClient?.nextCyclePreview.workedMinutes ?? 0),
            allocatedHours: toReportHours(cycleClient?.nextCyclePreview.targetMinutes ?? 0),
            overtimeHours: toReportHours(cycleClient?.nextCyclePreview.overtimeMinutes ?? 0),
          },
        };
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName, 'pt-BR'));

    const totalAllocatedHours = round2(
      clientBreakdown.reduce((sum, item) => sum + item.allocatedHours, 0)
    );
    const totalWorkedHours = round2(
      toHours(consultantEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0))
    );
    const consultantAllocations = relevantAllocations.filter(
      (allocation) => allocation.userId === consultant.id
    );
    const trend = calculateTrend(consultantEntries, consultantAllocations, endDate);

    const hasData = consultantEntries.length > 0 || clientBreakdown.length > 0;
    if (!hasData) continue;

    results.push({
      cycleMode: 'calendar_with_closure_split',
      userId: consultant.id,
      userName: consultant.name,
      userEmail: consultant.email,
      managerId: consultant.managerId,
      managerName: consultant.managerName,
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      allocatedHours: totalAllocatedHours,
      workedHours: totalWorkedHours,
      utilizationPercent: toPercent(totalWorkedHours, totalAllocatedHours),
      closedCycle: {
        workedHours: toReportHours(cycleSummary?.totals.closedCycle.workedMinutes ?? 0),
        allocatedHours: toReportHours(cycleSummary?.totals.closedCycle.targetMinutes ?? 0),
        overtimeHours: toReportHours(cycleSummary?.totals.closedCycle.overtimeMinutes ?? 0),
      },
      nextCyclePreview: {
        workedHours: toReportHours(cycleSummary?.totals.nextCyclePreview.workedMinutes ?? 0),
        allocatedHours: toReportHours(cycleSummary?.totals.nextCyclePreview.targetMinutes ?? 0),
        overtimeHours: toReportHours(cycleSummary?.totals.nextCyclePreview.overtimeMinutes ?? 0),
      },
      clientBreakdown,
      trend,
    });
  }

  return results.sort((a, b) => {
    const aValue = a.utilizationPercent ?? Number.POSITIVE_INFINITY;
    const bValue = b.utilizationPercent ?? Number.POSITIVE_INFINITY;
    return aValue - bValue;
  });
};

/**
 * ADM-02: Get capacity report for clients
 * Historical source of truth is time entries; allocation is optional metadata.
 */
export const getClientCapacityReport = async (
  filters: ClientCapacityFilters
): Promise<ClientCapacity[]> => {
  const { clientId, startDate, endDate, includeInactive = false } = filters;
  const workingDays = getWorkingDays(startDate, endDate);
  const monthsInPeriod = getMonthsInPeriod(startDate, endDate);

  const { baseClients, entries, allocations } = await reportRepository.getClientCapacityData({
    clientId,
    startDate,
    endDate,
    includeInactive,
  });

  const relevantEntries = entries.filter(
    (entry) => entry.user.roleId === 3 && !entry.user.deletedAt
  );
  const relevantAllocations = allocations.filter(
    (allocation) => allocation.user.roleId === 3 && !allocation.user.deletedAt
  ) as Array<AllocationWithRefs>;

  const clientMap = new Map<number, { id: number; name: string; code: string }>();
  baseClients.forEach((client) =>
    clientMap.set(client.id, { id: client.id, name: client.name, code: client.code })
  );
  relevantEntries.forEach((entry) => {
    clientMap.set(entry.clientId, {
      id: entry.client.id,
      name: entry.client.name,
      code: entry.client.code,
    });
  });

  const entriesByClient = new Map<number, typeof relevantEntries>();
  relevantEntries.forEach((entry) => {
    const list = entriesByClient.get(entry.clientId) ?? [];
    list.push(entry);
    entriesByClient.set(entry.clientId, list);
  });

  const allocationsByClientUser = new Map<string, AllocationWithRefs>();
  relevantAllocations.forEach((allocation) => {
    allocationsByClientUser.set(toKey(allocation.userId, allocation.clientId), allocation);
  });

  const results: ClientCapacity[] = [];
  const cycleYear = endDate.getUTCFullYear();
  const cycleMonth = endDate.getUTCMonth() + 1;
  const userIds = new Set<number>();
  relevantEntries.forEach((entry) => userIds.add(entry.userId));
  relevantAllocations.forEach((allocation) => userIds.add(allocation.userId));
  const cycleByConsultant = new Map<number, CycleSummaryResult>(
    await Promise.all(
      Array.from(userIds).map(
        async (userId) =>
          [
            userId,
            await computeCycleSummaryForUser({ userId, year: cycleYear, month: cycleMonth }),
          ] as const
      )
    )
  );

  for (const client of clientMap.values()) {
    const clientEntries = entriesByClient.get(client.id) ?? [];
    const userMap = new Map<number, string>();

    clientEntries.forEach((entry) => {
      userMap.set(entry.userId, entry.user.name);
    });
    relevantAllocations
      .filter((allocation) => allocation.clientId === client.id)
      .forEach((allocation) => {
        userMap.set(allocation.userId, allocation.user.name);
      });

    const consultantBreakdown = Array.from(userMap.entries())
      .map(([userId, userName]) => {
        const allocation = allocationsByClientUser.get(toKey(userId, client.id));
        const allocatedHours = getAllocatedHoursFromAllocation(
          allocation,
          workingDays,
          monthsInPeriod
        );
        const workedHours = round2(
          toHours(
            clientEntries
              .filter((entry) => entry.userId === userId)
              .reduce((sum, entry) => sum + entry.durationMinutes, 0)
          )
        );

        const cycleClient = cycleByConsultant
          .get(userId)
          ?.byClient.find((item: ClientCycleSummary) => item.clientId === client.id);

        return {
          userId,
          userName,
          allocatedHours,
          workedHours,
          utilizationPercent: toPercent(workedHours, allocatedHours),
          closedCycle: {
            workedHours: toReportHours(cycleClient?.closedCycle.workedMinutes ?? 0),
            allocatedHours: toReportHours(cycleClient?.closedCycle.targetMinutes ?? 0),
            overtimeHours: toReportHours(cycleClient?.closedCycle.overtimeMinutes ?? 0),
          },
          nextCyclePreview: {
            workedHours: toReportHours(cycleClient?.nextCyclePreview.workedMinutes ?? 0),
            allocatedHours: toReportHours(cycleClient?.nextCyclePreview.targetMinutes ?? 0),
            overtimeHours: toReportHours(cycleClient?.nextCyclePreview.overtimeMinutes ?? 0),
          },
        };
      })
      .sort((a, b) => a.userName.localeCompare(b.userName, 'pt-BR'));

    const totalAllocatedHours = round2(
      consultantBreakdown.reduce((sum, item) => sum + item.allocatedHours, 0)
    );
    const totalWorkedHours = round2(
      toHours(clientEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0))
    );
    const hasData =
      consultantBreakdown.length > 0 || totalWorkedHours > 0 || totalAllocatedHours > 0;
    if (!hasData) continue;

    const closedCycleTotals = consultantBreakdown.reduce(
      (acc, consultant) => {
        acc.worked += consultant.closedCycle.workedHours;
        acc.allocated += consultant.closedCycle.allocatedHours;
        acc.overtime += consultant.closedCycle.overtimeHours;
        return acc;
      },
      { worked: 0, allocated: 0, overtime: 0 }
    );
    const previewTotals = consultantBreakdown.reduce(
      (acc, consultant) => {
        acc.worked += consultant.nextCyclePreview.workedHours;
        acc.allocated += consultant.nextCyclePreview.allocatedHours;
        acc.overtime += consultant.nextCyclePreview.overtimeHours;
        return acc;
      },
      { worked: 0, allocated: 0, overtime: 0 }
    );

    results.push({
      cycleMode: 'calendar_with_closure_split',
      clientId: client.id,
      clientName: client.name,
      clientCode: client.code,
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      totalAllocatedHours,
      totalWorkedHours,
      remainingHours: round2(totalAllocatedHours - totalWorkedHours),
      utilizationPercent: toPercent(totalWorkedHours, totalAllocatedHours),
      closedCycle: {
        workedHours: round2(closedCycleTotals.worked),
        allocatedHours: round2(closedCycleTotals.allocated),
        overtimeHours: round2(closedCycleTotals.overtime),
      },
      nextCyclePreview: {
        workedHours: round2(previewTotals.worked),
        allocatedHours: round2(previewTotals.allocated),
        overtimeHours: round2(previewTotals.overtime),
      },
      consultantBreakdown,
    });
  }

  return results.sort((a, b) => a.remainingHours - b.remainingHours);
};

// Helper: Calculate working days (excluding weekends)
function getWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// Helper: Calculate months in period (fractional)
function getMonthsInPeriod(start: Date, end: Date): number {
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
}

// Helper: Calculate weekly trend
function calculateTrend(
  timeEntries: Array<{ date: Date; durationMinutes: number }>,
  allocations: Array<{
    allocationType: ReportAllocationType;
    hoursPerDay: number | null;
    hoursPerMonth: number | null;
  }>,
  endDate: Date
): Array<{
  period: string;
  allocatedHours: number;
  workedHours: number;
  utilizationPercent: NullablePercent;
}> {
  const trends: Array<{
    period: string;
    allocatedHours: number;
    workedHours: number;
    utilizationPercent: NullablePercent;
  }> = [];

  for (let i = 3; i >= 0; i--) {
    const weekEnd = new Date(endDate);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const weekWorkingDays = getWorkingDays(weekStart, weekEnd);
    let weekAllocatedHours = 0;
    for (const allocation of allocations) {
      if (allocation.allocationType === 'DAILY' && allocation.hoursPerDay) {
        weekAllocatedHours += allocation.hoursPerDay * weekWorkingDays;
      } else if (allocation.allocationType === 'MONTHLY' && allocation.hoursPerMonth) {
        weekAllocatedHours += allocation.hoursPerMonth / 4.33;
      }
    }

    const weekEntries = timeEntries.filter((entry) => {
      const entryDate = new Date(entry.date);
      return entryDate >= weekStart && entryDate <= weekEnd;
    });
    const weekWorkedHours = toHours(
      weekEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0)
    );
    const roundedAllocatedHours = round2(weekAllocatedHours);
    const roundedWorkedHours = round2(weekWorkedHours);

    trends.push({
      period: `${weekStart.toISOString().split('T')[0]} - ${weekEnd.toISOString().split('T')[0]}`,
      allocatedHours: roundedAllocatedHours,
      workedHours: roundedWorkedHours,
      utilizationPercent: toPercent(roundedWorkedHours, roundedAllocatedHours),
    });
  }

  return trends;
}
