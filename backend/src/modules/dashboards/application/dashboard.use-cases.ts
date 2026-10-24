import type { CycleSummaryResult } from '../../closing-cycle/application/closing-cycle.service.js';
import {
  computeCycleSummariesForUsers,
  computeCycleSummaryForUser,
} from '../../closing-cycle/application/closing-cycle.service.js';
import { getManagedConsultantIds } from '../../historical-access/application/historical-access.service.js';
import type {
  DailyBucket,
  AdminDashboardResult,
  ConsultantDashboardResult,
  ManagerDashboardResult,
} from '../domain/dashboard.types.js';
import {
  dashboardRepository,
  formatDateKeyUTC,
  resolveDashboardRange,
} from '../infrastructure/dashboard.repository.js';

type DailyEntryRow = Awaited<ReturnType<typeof dashboardRepository.getDailyEntries>>[number];

const buildDailyBucketsFromEntries = (
  entries: DailyEntryRow[],
  start: Date,
  end: Date
): DailyBucket[] => {
  const bucketsByDate = new Map<string, Map<number, DailyBucket['clients'][number]>>();
  entries.forEach((entry) => {
    const dayKey = formatDateKeyUTC(entry.date);
    const clientsMap =
      bucketsByDate.get(dayKey) ?? new Map<number, DailyBucket['clients'][number]>();
    const clientBucket = clientsMap.get(entry.client.id) ?? {
      clientId: entry.client.id,
      clientName: entry.client.name,
      minutes: 0,
      entries: [],
    };
    clientBucket.minutes += entry.durationMinutes;
    clientBucket.entries.push({
      id: entry.id,
      userId: entry.userId,
      userName: entry.user.name,
      activityDescription: entry.activityDescription,
      durationMinutes: entry.durationMinutes,
    });
    clientsMap.set(entry.client.id, clientBucket);
    bucketsByDate.set(dayKey, clientsMap);
  });

  const buckets: DailyBucket[] = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    const dayKey = formatDateKeyUTC(cursor);
    const clientsMap =
      bucketsByDate.get(dayKey) ?? new Map<number, DailyBucket['clients'][number]>();
    const clients = Array.from(clientsMap.values());
    const totalMinutes = clients.reduce((acc, client) => acc + client.minutes, 0);
    buckets.push({ date: dayKey, totalMinutes, clients });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets;
};

const buildDailyBreakdown = async (
  userIds: number[],
  year: number,
  month: number,
  clientId?: number,
  startDate?: string,
  endDate?: string
): Promise<DailyBucket[]> => {
  if (userIds.length === 0) return [];
  const { start, end } = resolveDashboardRange(year, month, startDate, endDate);
  const entries = await dashboardRepository.getDailyEntries(userIds, start, end, clientId);
  return buildDailyBucketsFromEntries(entries, start, end);
};

const toHours = (minutes: number): number => Math.round((minutes / 60) * 100) / 100;

export const getConsultantDashboard = async (
  userId: number,
  year: number,
  month: number,
  startDate?: string,
  endDate?: string
): Promise<ConsultantDashboardResult> => {
  const [entries, daily, cycleSummary] = await Promise.all([
    dashboardRepository.getUserMonthEntries(userId, year, month),
    buildDailyBreakdown([userId], year, month, undefined, startDate, endDate),
    computeCycleSummaryForUser({ userId, year, month }),
  ]);

  const cycleClients = await dashboardRepository.findClientsByIds(
    cycleSummary.byClient.map((item) => item.clientId)
  );
  const cycleClientById = new Map(cycleClients.map((client) => [client.id, client]));
  const totalMinutes = cycleSummary.totals.closedCycle.workedMinutes;
  const targetMinutes = cycleSummary.totals.closedCycle.targetMinutes;

  return {
    totalHours: toHours(totalMinutes),
    totalMinutes,
    targetHours: toHours(targetMinutes),
    targetMinutes,
    progressPercent:
      targetMinutes > 0
        ? Math.round((cycleSummary.totals.closedCycle.normalMinutes / targetMinutes) * 10000) / 100
        : 0,
    byClient: cycleSummary.byClient.map((client) => ({
      clientId: client.clientId,
      clientName: client.clientName,
      paysOvertime: cycleClientById.get(client.clientId)?.paysOvertime ?? true,
      hours: toHours(client.closedCycle.workedMinutes),
      targetMinutes: client.closedCycle.targetMinutes,
    })),
    daily,
    overtimeMinutes: cycleSummary.totals.closedCycle.overtimeMinutes,
    overtimeByClient: cycleSummary.byClient
      .map((client) => ({
        clientId: client.clientId,
        clientName: client.clientName,
        paysOvertime: cycleClientById.get(client.clientId)?.paysOvertime ?? true,
        targetMinutes: client.closedCycle.targetMinutes,
        overtimeMinutes: client.closedCycle.overtimeMinutes,
      }))
      .filter((item) => item.overtimeMinutes > 0),
    cycleSummary,
    entries,
  };
};

export const getManagerDashboard = async (
  managerId: number,
  year: number,
  month: number,
  consultantId?: number,
  clientId?: number,
  startDate?: string,
  endDate?: string
): Promise<ManagerDashboardResult> => {
  const { start, end } = resolveDashboardRange(year, month);
  const managedConsultantIds = await getManagedConsultantIds(managerId, {
    startDate: start,
    endDate: end,
  });
  const consultants = await dashboardRepository.findConsultantsByIds(
    managedConsultantIds,
    consultantId
  );

  if (consultants.length === 0) {
    return { consultants: [] };
  }

  const consultantIds = consultants.map((consultant) => consultant.id);
  const dailyRange = resolveDashboardRange(year, month, startDate, endDate);
  const filterClientId = clientId || undefined;

  const [allDailyEntries, cycleSummariesByUser] = await Promise.all([
    dashboardRepository.getDailyEntries(
      consultantIds,
      dailyRange.start,
      dailyRange.end,
      filterClientId
    ),
    computeCycleSummariesForUsers({
      userIds: consultantIds,
      year,
      month,
      clientId: filterClientId,
    }),
  ]);

  const dailyEntriesByUser = new Map<number, DailyEntryRow[]>();
  allDailyEntries.forEach((entry) => {
    const bucket = dailyEntriesByUser.get(entry.userId) ?? [];
    bucket.push(entry);
    dailyEntriesByUser.set(entry.userId, bucket);
  });

  const cycleClientIds = Array.from(
    new Set(
      Array.from(cycleSummariesByUser.values()).flatMap((summary) =>
        summary.byClient.map((item) => item.clientId)
      )
    )
  );
  const cycleClients = await dashboardRepository.findClientsByIds(cycleClientIds);
  const cycleClientById = new Map(cycleClients.map((client) => [client.id, client]));

  const results = consultants.map((consultant) => {
    const cycleSummary = cycleSummariesByUser.get(consultant.id) ?? {
      byClient: [],
      totals: {
        closedCycle: {
          workedMinutes: 0,
          targetMinutes: 0,
          normalMinutes: 0,
          overtimeMinutes: 0,
        },
        nextCyclePreview: {
          workedMinutes: 0,
          targetMinutes: 0,
          normalMinutes: 0,
          overtimeMinutes: 0,
        },
      },
    };
    if (
      clientId &&
      !cycleSummary.byClient.some(
        (item) =>
          item.clientId === clientId &&
          (item.closedCycle.workedMinutes > 0 || item.closedCycle.targetMinutes > 0)
      )
    ) {
      return null;
    }

    const daily = buildDailyBucketsFromEntries(
      dailyEntriesByUser.get(consultant.id) ?? [],
      dailyRange.start,
      dailyRange.end
    );
    const totalMinutes = cycleSummary.totals.closedCycle.workedMinutes;
    const targetMinutes = cycleSummary.totals.closedCycle.targetMinutes;

    return {
      id: consultant.id,
      name: consultant.name,
      totalHours: toHours(totalMinutes),
      totalMinutes,
      targetHours: toHours(targetMinutes),
      targetMinutes,
      progressPercent:
        targetMinutes > 0
          ? Math.round((cycleSummary.totals.closedCycle.normalMinutes / targetMinutes) * 10000) /
            100
          : 0,
      byClient: cycleSummary.byClient.map((client) => ({
        clientId: client.clientId,
        clientName: client.clientName,
        paysOvertime: cycleClientById.get(client.clientId)?.paysOvertime ?? true,
        hours: toHours(client.closedCycle.workedMinutes),
        targetMinutes: client.closedCycle.targetMinutes,
      })),
      daily,
      overtimeMinutes: cycleSummary.totals.closedCycle.overtimeMinutes,
      overtimeByClient: cycleSummary.byClient
        .map((client) => ({
          clientId: client.clientId,
          clientName: client.clientName,
          paysOvertime: cycleClientById.get(client.clientId)?.paysOvertime ?? true,
          targetMinutes: client.closedCycle.targetMinutes,
          overtimeMinutes: client.closedCycle.overtimeMinutes,
        }))
        .filter((item) => item.overtimeMinutes > 0),
      cycleSummary,
    };
  });

  return { consultants: results.filter((item): item is NonNullable<typeof item> => Boolean(item)) };
};

export const getAdminDashboard = async (
  year: number,
  month: number,
  startDate?: string,
  endDate?: string
): Promise<AdminDashboardResult> => {
  const { start, end } = resolveDashboardRange(year, month, startDate, endDate);

  const [totalConsultants, daily, entries, consultants] = await Promise.all([
    dashboardRepository.countConsultants(),
    buildDailyBreakdown(
      (await dashboardRepository.getActiveConsultants()).map((item) => item.id),
      year,
      month,
      undefined,
      startDate,
      endDate
    ),
    dashboardRepository.getEntriesForRange(start, end),
    dashboardRepository.getActiveConsultants(),
  ]);

  const totalMinutes = entries.reduce((acc, entry) => acc + entry.durationMinutes, 0);
  const minutesByClientAll = new Map<number, number>();
  const minutesByUserAll = new Map<number, number>();
  entries.forEach((entry) => {
    minutesByClientAll.set(
      entry.clientId,
      (minutesByClientAll.get(entry.clientId) ?? 0) + entry.durationMinutes
    );
    minutesByUserAll.set(
      entry.userId,
      (minutesByUserAll.get(entry.userId) ?? 0) + entry.durationMinutes
    );
  });

  const groupedByClient = Array.from(minutesByClientAll.entries())
    .map(([clientId, minutes]) => ({ clientId, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);
  const groupedByUser = Array.from(minutesByUserAll.entries())
    .map(([userId, minutes]) => ({ userId, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);

  const consultantIdsForCycle = consultants.map((consultant) => consultant.id);
  const [topClientsRaw, topUsersRaw, cycleSummariesByUser] = await Promise.all([
    dashboardRepository.findClientsByIds(groupedByClient.map((item) => item.clientId)),
    dashboardRepository.findUsersByIds(groupedByUser.map((item) => item.userId)),
    computeCycleSummariesForUsers({
      userIds: consultantIdsForCycle,
      year,
      month,
    }),
  ]);

  const cycleByConsultant = consultants.map((consultant) => ({
    userId: consultant.id,
    userName: consultant.name,
    summary:
      cycleSummariesByUser.get(consultant.id) ??
      ({
        byClient: [],
        totals: {
          closedCycle: {
            workedMinutes: 0,
            targetMinutes: 0,
            normalMinutes: 0,
            overtimeMinutes: 0,
          },
          nextCyclePreview: {
            workedMinutes: 0,
            targetMinutes: 0,
            normalMinutes: 0,
            overtimeMinutes: 0,
          },
        },
      } satisfies CycleSummaryResult),
  }));

  const topClientById = new Map(topClientsRaw.map((client) => [client.id, client]));
  const topClients = groupedByClient.map((item) => ({
    clientId: item.clientId,
    clientName: topClientById.get(item.clientId)?.name || 'Unknown',
    hours: toHours(item.minutes),
    paysOvertime: topClientById.get(item.clientId)?.paysOvertime ?? true,
  }));

  const topUserNameById = new Map(topUsersRaw.map((user) => [user.id, user.name]));
  const topConsultants = groupedByUser.map((item) => ({
    userId: item.userId,
    userName: topUserNameById.get(item.userId) || 'Unknown',
    hours: toHours(item.minutes),
  }));

  const overtimeByClient = new Map<number, number>();
  const overtimeByConsultant = new Map<number, number>();
  const cycleTotals: CycleSummaryResult['totals'] = {
    closedCycle: { workedMinutes: 0, targetMinutes: 0, normalMinutes: 0, overtimeMinutes: 0 },
    nextCyclePreview: { workedMinutes: 0, targetMinutes: 0, normalMinutes: 0, overtimeMinutes: 0 },
  };

  cycleByConsultant.forEach((item) => {
    const closed = item.summary.totals.closedCycle;
    const preview = item.summary.totals.nextCyclePreview;
    cycleTotals.closedCycle.workedMinutes += closed.workedMinutes;
    cycleTotals.closedCycle.targetMinutes += closed.targetMinutes;
    cycleTotals.closedCycle.normalMinutes += closed.normalMinutes;
    cycleTotals.closedCycle.overtimeMinutes += closed.overtimeMinutes;
    cycleTotals.nextCyclePreview.workedMinutes += preview.workedMinutes;
    cycleTotals.nextCyclePreview.targetMinutes += preview.targetMinutes;
    cycleTotals.nextCyclePreview.normalMinutes += preview.normalMinutes;
    cycleTotals.nextCyclePreview.overtimeMinutes += preview.overtimeMinutes;

    if (closed.overtimeMinutes > 0) overtimeByConsultant.set(item.userId, closed.overtimeMinutes);
    item.summary.byClient.forEach((clientSummary) => {
      if (!clientSummary.closedCycle.overtimeMinutes) return;
      overtimeByClient.set(
        clientSummary.clientId,
        (overtimeByClient.get(clientSummary.clientId) ?? 0) +
          clientSummary.closedCycle.overtimeMinutes
      );
    });
  });

  const overtimeClients = await dashboardRepository.findClientsByIds(
    Array.from(overtimeByClient.keys())
  );
  const overtimeClientById = new Map(overtimeClients.map((client) => [client.id, client]));
  const overtimeUsers = await dashboardRepository.findUsersByIds(
    Array.from(overtimeByConsultant.keys())
  );
  const overtimeUserById = new Map(overtimeUsers.map((user) => [user.id, user.name]));
  const targetMinutes = cycleTotals.closedCycle.targetMinutes;

  return {
    totalConsultants,
    totalHours: toHours(totalMinutes),
    totalMinutes,
    targetHours: toHours(targetMinutes),
    targetMinutes,
    progressPercent:
      targetMinutes > 0
        ? Math.round((cycleTotals.closedCycle.normalMinutes / targetMinutes) * 10000) / 100
        : 0,
    overtimeMinutes: Array.from(overtimeByConsultant.values()).reduce((acc, item) => acc + item, 0),
    overtimeByClient: Array.from(overtimeByClient.entries())
      .map(([clientId, minutes]) => ({
        clientId,
        clientName: overtimeClientById.get(clientId)?.name || 'Unknown',
        paysOvertime: overtimeClientById.get(clientId)?.paysOvertime ?? true,
        overtimeMinutes: minutes,
      }))
      .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes),
    overtimeByConsultant: Array.from(overtimeByConsultant.entries())
      .map(([userId, minutes]) => ({
        userId,
        userName: overtimeUserById.get(userId) || 'Unknown',
        overtimeMinutes: minutes,
      }))
      .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes),
    cycleSummary: {
      consultants: cycleByConsultant.map((item) => ({
        userId: item.userId,
        summary: item.summary,
      })),
      totals: cycleTotals,
    },
    topClients,
    topConsultants,
    daily,
  };
};
