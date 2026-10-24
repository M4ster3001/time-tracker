import {
  computeCycleSummaryForUser as computeCycleSummaryForUserPolicy,
  type CycleAllocationLike,
  type CycleClientLike,
  type CycleEntryLike,
  type CycleSummaryResult,
} from '../../../shared/domain/policies/closing-cycle.policy.js';
import { getClosingPeriodRangeUTC } from '../../../shared/domain/date.js';
import { addDaysUTC } from '../../../services/date/utc-date.service.js';
import type {
  AllocationHistoryRow,
  ClosingCycleRepository,
} from '../domain/repositories/closing-cycle.repository.js';
import { closingCycleRepository as defaultRepository } from '../infrastructure/repositories/prisma-closing-cycle.repository.js';
import { resolveLockDay } from '../../time-tracking/domain/policies/time-entry-lock.policy.js';

export type {
  CycleAllocationLike,
  CycleClientLike,
  CycleEntryLike,
  CycleSummaryResult,
} from '../../../shared/domain/policies/closing-cycle.policy.js';

const defaultEffectiveFromForMonth = (year: number, month: number): Date =>
  new Date(Date.UTC(year, month - 1, 1));

const normalizeAllocationHistory = (
  allocations: Array<Partial<AllocationHistoryRow>>,
  userId: number,
  defaultEffectiveFrom: Date
): CycleAllocationLike[] =>
  allocations
    .filter((allocation) => typeof allocation.clientId === 'number')
    .map((allocation) => ({
      userId: allocation.userId ?? userId,
      clientId: allocation.clientId as number,
      allocationType: allocation.allocationType ?? 'MONTHLY',
      hoursPerDay: allocation.hoursPerDay ?? null,
      hoursPerMonth: allocation.hoursPerMonth ?? null,
      effectiveFrom: allocation.effectiveFrom ?? defaultEffectiveFrom,
      effectiveTo: allocation.effectiveTo ?? null,
    }));

const fetchAllocationHistory = async (
  params: {
    userId: number;
    clientIds: number[];
    minStart: Date;
    maxEnd: Date;
    defaultEffectiveFrom: Date;
  },
  repository: ClosingCycleRepository
): Promise<CycleAllocationLike[]> => {
  const allocationHistoryRaw = await repository.findAllocationHistoryInRange({
    userId: params.userId,
    clientIds: params.clientIds,
    minStart: params.minStart,
    maxEnd: params.maxEnd,
  });

  let allocationHistory = normalizeAllocationHistory(
    allocationHistoryRaw,
    params.userId,
    params.defaultEffectiveFrom
  );

  if (allocationHistory.length === 0 && params.clientIds.length > 0) {
    const fallbackAllocations = await repository.findCurrentAllocationSnapshot(
      params.userId,
      params.clientIds
    );

    allocationHistory = fallbackAllocations.map((allocation) => ({
      userId: allocation.userId,
      clientId: allocation.clientId,
      allocationType: allocation.allocationType,
      hoursPerDay: allocation.hoursPerDay,
      hoursPerMonth: allocation.hoursPerMonth,
      effectiveFrom: params.defaultEffectiveFrom,
      effectiveTo: null,
    }));
  }

  return allocationHistory;
};

const emptyCycleSummary = (): CycleSummaryResult => ({
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
});

export const computeCycleSummaryForUser = async (
  params: {
    userId: number;
    year: number;
    month: number;
    clientId?: number;
  },
  repository: ClosingCycleRepository = defaultRepository
): Promise<CycleSummaryResult> => {
  const monthEnd = new Date(Date.UTC(params.year, params.month, 0));
  const previousMonthStart = new Date(Date.UTC(params.year, params.month - 2, 1));

  const [currentLinkClientIds, monthlyEntryClientIds] = await Promise.all([
    repository.findClientIdsLinkedToUser(params.userId),
    repository.findClientIdsWithTimeEntriesInRange(params.userId, previousMonthStart, monthEnd),
  ]);

  const allowedClientIds = new Set<number>();
  currentLinkClientIds.forEach((id) => allowedClientIds.add(id));
  monthlyEntryClientIds.forEach((id) => allowedClientIds.add(id));

  if (params.clientId) {
    if (!allowedClientIds.has(params.clientId)) {
      return emptyCycleSummary();
    }
    allowedClientIds.clear();
    allowedClientIds.add(params.clientId);
  }

  if (allowedClientIds.size === 0) {
    return emptyCycleSummary();
  }

  const clients = (await repository.findClientsByIds(Array.from(allowedClientIds)))
    .map((client) => ({ ...client, lockDay: resolveLockDay(client.lockDay) ?? 31 }));

  if (clients.length === 0) {
    return emptyCycleSummary();
  }

  const windows = clients.map((client) => {
    const { start: closedStart, end: closedEnd } = getClosingPeriodRangeUTC(
      params.year,
      params.month,
      client.lockDay ?? 31
    );
    const previewStart = addDaysUTC(closedEnd, 1);
    const previewEnd = new Date(Date.UTC(params.year, params.month, 0));
    return {
      client,
      closedStart,
      closedEnd,
      previewEnd: previewStart.getTime() <= previewEnd.getTime() ? previewEnd : previewStart,
    };
  });

  const minStart = windows.reduce(
    (acc, item) => (!acc || item.closedStart < acc ? item.closedStart : acc),
    null as Date | null
  );
  const maxEnd = windows.reduce(
    (acc, item) => (!acc || item.previewEnd > acc ? item.previewEnd : acc),
    null as Date | null
  );

  if (!minStart || !maxEnd) {
    return emptyCycleSummary();
  }

  const clientIds = clients.map((client) => client.id);

  const [entries, allocationHistory] = await Promise.all([
    repository.findTimeEntriesInRange(params.userId, clientIds, minStart, maxEnd),
    fetchAllocationHistory(
      {
        userId: params.userId,
        clientIds,
        minStart,
        maxEnd,
        defaultEffectiveFrom: defaultEffectiveFromForMonth(params.year, params.month),
      },
      repository
    ),
  ]);

  return computeCycleSummaryForUserPolicy({
    year: params.year,
    month: params.month,
    clients: clients as CycleClientLike[],
    entries: entries as CycleEntryLike[],
    allocations: allocationHistory,
  });
};

const resolveCycleWindows = (
  clients: Array<{ id: number; name: string; lockDay: number | null }>,
  year: number,
  month: number
) => {
  const windows = clients.map((client) => {
    const { start: closedStart, end: closedEnd } = getClosingPeriodRangeUTC(
      year,
      month,
      client.lockDay ?? 31
    );
    const previewStart = addDaysUTC(closedEnd, 1);
    const previewEnd = new Date(Date.UTC(year, month, 0));
    return {
      closedStart,
      previewEnd: previewStart.getTime() <= previewEnd.getTime() ? previewEnd : previewStart,
    };
  });

  const minStart = windows.reduce(
    (acc, item) => (!acc || item.closedStart < acc ? item.closedStart : acc),
    null as Date | null
  );
  const maxEnd = windows.reduce(
    (acc, item) => (!acc || item.previewEnd > acc ? item.previewEnd : acc),
    null as Date | null
  );

  return { minStart, maxEnd };
};

export const computeCycleSummariesForUsers = async (
  params: {
    userIds: number[];
    year: number;
    month: number;
    clientId?: number;
  },
  repository: ClosingCycleRepository = defaultRepository
): Promise<Map<number, CycleSummaryResult>> => {
  const result = new Map<number, CycleSummaryResult>();
  if (params.userIds.length === 0) {
    return result;
  }

  const monthEnd = new Date(Date.UTC(params.year, params.month, 0));
  const previousMonthStart = new Date(Date.UTC(params.year, params.month - 2, 1));
  const defaultEffectiveFrom = defaultEffectiveFromForMonth(params.year, params.month);

  const [linkedLinks, entryLinks] = await Promise.all([
    repository.findClientIdsLinkedToUsers(params.userIds),
    repository.findClientIdsWithTimeEntriesInRangeForUsers(
      params.userIds,
      previousMonthStart,
      monthEnd
    ),
  ]);

  const allowedClientIdsByUser = new Map<number, Set<number>>();
  params.userIds.forEach((userId) => allowedClientIdsByUser.set(userId, new Set()));

  const addLink = (userId: number, clientId: number) => {
    const set = allowedClientIdsByUser.get(userId);
    if (set) set.add(clientId);
  };
  linkedLinks.forEach((link) => addLink(link.userId, link.clientId));
  entryLinks.forEach((link) => addLink(link.userId, link.clientId));

  if (params.clientId) {
    allowedClientIdsByUser.forEach((set) => {
      if (set.has(params.clientId!)) {
        set.clear();
        set.add(params.clientId!);
      } else {
        set.clear();
      }
    });
  }

  const allClientIds = Array.from(
    new Set(
      Array.from(allowedClientIdsByUser.values()).flatMap((set) => Array.from(set.values()))
    )
  );

  if (allClientIds.length === 0) {
    params.userIds.forEach((userId) => result.set(userId, emptyCycleSummary()));
    return result;
  }

  const clients = (await repository.findClientsByIds(allClientIds)).map((client) => ({
    ...client,
    lockDay: resolveLockDay(client.lockDay) ?? 31,
  }));
  const clientById = new Map(clients.map((client) => [client.id, client]));

  if (clients.length === 0) {
    params.userIds.forEach((userId) => result.set(userId, emptyCycleSummary()));
    return result;
  }

  const { minStart, maxEnd } = resolveCycleWindows(clients, params.year, params.month);
  if (!minStart || !maxEnd) {
    params.userIds.forEach((userId) => result.set(userId, emptyCycleSummary()));
    return result;
  }

  const activeUserIds = params.userIds.filter(
    (userId) => (allowedClientIdsByUser.get(userId)?.size ?? 0) > 0
  );

  const [entries, allocationHistoryRaw] = await Promise.all([
    repository.findTimeEntriesInRangeForUsers(activeUserIds, allClientIds, minStart, maxEnd),
    repository.findAllocationHistoryInRangeForUsers({
      userIds: activeUserIds,
      clientIds: allClientIds,
      minStart,
      maxEnd,
    }),
  ]);

  const entriesByUser = new Map<number, CycleEntryLike[]>();
  entries.forEach((entry) => {
    const list = entriesByUser.get(entry.userId) ?? [];
    list.push(entry);
    entriesByUser.set(entry.userId, list);
  });

  const historyByUser = new Map<number, CycleAllocationLike[]>();
  allocationHistoryRaw.forEach((row) => {
    if (typeof row.userId !== 'number' || typeof row.clientId !== 'number') return;
    const list = historyByUser.get(row.userId) ?? [];
    list.push(...normalizeAllocationHistory([row], row.userId, defaultEffectiveFrom));
    historyByUser.set(row.userId, list);
  });

  const usersNeedingSnapshot = activeUserIds.filter(
    (userId) =>
      (historyByUser.get(userId)?.length ?? 0) === 0 &&
      (allowedClientIdsByUser.get(userId)?.size ?? 0) > 0
  );

  if (usersNeedingSnapshot.length > 0) {
    const snapshotClientIds = Array.from(
      new Set(
        usersNeedingSnapshot.flatMap((userId) =>
          Array.from(allowedClientIdsByUser.get(userId) ?? [])
        )
      )
    );
    const snapshots = await repository.findCurrentAllocationSnapshotsForUsers(
      usersNeedingSnapshot,
      snapshotClientIds
    );
    snapshots.forEach((allocation) => {
      const list = historyByUser.get(allocation.userId) ?? [];
      list.push({
        userId: allocation.userId,
        clientId: allocation.clientId,
        allocationType: allocation.allocationType,
        hoursPerDay: allocation.hoursPerDay,
        hoursPerMonth: allocation.hoursPerMonth,
        effectiveFrom: defaultEffectiveFrom,
        effectiveTo: null,
      });
      historyByUser.set(allocation.userId, list);
    });
  }

  params.userIds.forEach((userId) => {
    const allowed = allowedClientIdsByUser.get(userId);
    if (!allowed || allowed.size === 0) {
      result.set(userId, emptyCycleSummary());
      return;
    }

    const userClients = Array.from(allowed)
      .map((clientId) => clientById.get(clientId))
      .filter((client): client is NonNullable<typeof client> => Boolean(client));

    if (userClients.length === 0) {
      result.set(userId, emptyCycleSummary());
      return;
    }

    const userClientIdSet = new Set(userClients.map((client) => client.id));
    const userEntries = (entriesByUser.get(userId) ?? []).filter((entry) =>
      userClientIdSet.has(entry.clientId)
    );
    const userAllocations = (historyByUser.get(userId) ?? []).filter((allocation) =>
      userClientIdSet.has(allocation.clientId)
    );

    result.set(
      userId,
      computeCycleSummaryForUserPolicy({
        year: params.year,
        month: params.month,
        clients: userClients as CycleClientLike[],
        entries: userEntries,
        allocations: userAllocations,
      })
    );
  });

  return result;
};
