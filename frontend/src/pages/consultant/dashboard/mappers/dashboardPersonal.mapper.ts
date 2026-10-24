import { formatMinutes } from '../../../../utils/formatters';
import type {
  ActivitySuggestion,
  ClientOption,
  DashboardPersonalInsights,
  DashboardPersonalOverviewMetrics,
  DashboardResponse,
} from '../types/dashboardPersonal.types';
import type { TimelinePoint } from '../../../../components/DashboardPanels';

const getDaysUntilNextClosing = (lockDay: number, today: Date) => {
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentMonthClosing = new Date(
    year,
    month,
    Math.min(lockDay, new Date(year, month + 1, 0).getDate())
  );
  const target =
    currentMonthClosing >= today
      ? currentMonthClosing
      : new Date(year, month + 1, Math.min(lockDay, new Date(year, month + 2, 0).getDate()));
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

export const buildRecentWeekPoints = (
  daily: DashboardResponse['daily'],
  weeksBack = 0
): TimelinePoint[] => {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const endIndex = Math.max(0, sorted.length - weeksBack * 7);
  const slice = sorted.slice(Math.max(0, endIndex - 7), endIndex);
  return slice.map((day) => ({
    label: day.date.slice(8),
    value: day.totalMinutes,
    caption: formatMinutes(day.totalMinutes),
  }));
};

export const getPointsTotal = (points: TimelinePoint[]) =>
  points.reduce((acc, point) => acc + point.value, 0);

const normalizeQuickLogKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');

export const buildQuickLogSuggestionsFromEntries = (
  entries: DashboardResponse['entries'],
  selectedClientId?: number,
  limit = 8
): ActivitySuggestion[] => {
  const filteredEntries = selectedClientId
    ? entries.filter((entry) => entry.clientId === selectedClientId)
    : entries;
  const grouped = new Map<
    string,
    {
      latestLabel: string;
      latestTimestamp: number;
      usageCount: number;
      durations: Map<number, { usageCount: number; latestTimestamp: number }>;
    }
  >();

  for (const entry of filteredEntries) {
    const key = normalizeQuickLogKey(entry.activityDescription);
    if (!key) continue;

    const timestamp = new Date(entry.date).getTime();
    const current = grouped.get(key) ?? {
      latestLabel: entry.activityDescription.trim(),
      latestTimestamp: timestamp,
      usageCount: 0,
      durations: new Map<number, { usageCount: number; latestTimestamp: number }>(),
    };

    current.usageCount += 1;
    if (timestamp >= current.latestTimestamp) {
      current.latestLabel = entry.activityDescription.trim();
      current.latestTimestamp = timestamp;
    }

    const durationStats = current.durations.get(entry.durationMinutes) ?? {
      usageCount: 0,
      latestTimestamp: timestamp,
    };
    durationStats.usageCount += 1;
    durationStats.latestTimestamp = Math.max(durationStats.latestTimestamp, timestamp);
    current.durations.set(entry.durationMinutes, durationStats);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((group): ActivitySuggestion => {
      const [bestDuration] = Array.from(group.durations.entries()).sort((left, right) => {
        if (right[1].usageCount !== left[1].usageCount) {
          return right[1].usageCount - left[1].usageCount;
        }
        return right[1].latestTimestamp - left[1].latestTimestamp;
      });

      return {
        name: group.latestLabel,
        suggestedDurationMinutes: bestDuration?.[0] ?? 30,
        usageCount: group.usageCount,
        lastUsedAt: new Date(group.latestTimestamp).toISOString(),
        source: selectedClientId ? 'client' : 'global',
      };
    })
    .sort((left, right) => {
      if (right.usageCount !== left.usageCount) {
        return right.usageCount - left.usageCount;
      }
      return new Date(right.lastUsedAt ?? 0).getTime() - new Date(left.lastUsedAt ?? 0).getTime();
    })
    .slice(0, limit);
};

export const buildDashboardPersonalOverviewMetrics = (
  dashboard: DashboardResponse | null,
  clientId: number
): DashboardPersonalOverviewMetrics => {
  if (!dashboard) {
    return {
      normalMinutes: 0,
      targetMinutes: 0,
      overtimeMinutes: 0,
      previewOvertimeMinutes: 0,
      totalMinutes: 0,
      byClient: [],
      filteredEntries: [],
    };
  }

  const filteredEntries = clientId
    ? dashboard.entries.filter((entry) => entry.clientId === clientId)
    : dashboard.entries;
  const totalMinutes = filteredEntries.reduce((acc, entry) => acc + entry.durationMinutes, 0);
  const cycleByClientRaw =
    dashboard.cycleSummary?.byClient.map((item) => ({
      clientId: item.clientId,
      clientName: item.clientName,
      workedMinutes: item.closedCycle.workedMinutes,
      targetMinutes: item.closedCycle.targetMinutes,
      overtimeMinutes: item.closedCycle.overtimeMinutes,
      previewOvertimeMinutes: item.nextCyclePreview.overtimeMinutes,
    })) ??
    dashboard.byClient.map((client) => ({
      clientId: client.clientId,
      clientName: client.clientName,
      workedMinutes: Math.round(client.hours * 60),
      targetMinutes: client.targetMinutes,
      overtimeMinutes:
        dashboard.overtimeByClient.find((item) => item.clientId === client.clientId)
          ?.overtimeMinutes ?? 0,
      previewOvertimeMinutes: 0,
    }));
  const byClient = clientId
    ? cycleByClientRaw.filter((client) => client.clientId === clientId)
    : cycleByClientRaw;
  const targetMinutes = byClient.reduce((acc, client) => acc + client.targetMinutes, 0);
  const overtimeMinutes = byClient.reduce((acc, client) => acc + client.overtimeMinutes, 0);
  const previewOvertimeMinutes = byClient.reduce(
    (acc, client) => acc + client.previewOvertimeMinutes,
    0
  );
  const normalMinutes = byClient.reduce(
    (acc, client) => acc + Math.max(0, client.workedMinutes - client.overtimeMinutes),
    0
  );

  return {
    normalMinutes,
    targetMinutes,
    overtimeMinutes,
    previewOvertimeMinutes,
    totalMinutes,
    byClient,
    filteredEntries,
  };
};

export const buildDashboardPersonalInsights = (params: {
  dashboard: DashboardResponse | null;
  clients: ClientOption[];
  todayKey: string;
  currentDate?: Date;
  formatRangeLabel: (startDate: string, endDate: string) => string;
  formatMinutes: (minutes: number) => string;
}): DashboardPersonalInsights => {
  const {
    dashboard,
    clients,
    todayKey,
    currentDate = new Date(),
    formatRangeLabel,
    formatMinutes,
  } = params;

  if (!dashboard) {
    return {
      cycleItems: [],
      pendingClients: [],
      closingSoonClients: [],
      unusedAllocations: [],
      feedItems: [],
    };
  }

  const todayBucket = dashboard.daily.find((day) => day.date === todayKey);
  const todaysClientIds = new Set(todayBucket?.clients.map((client) => client.clientId) ?? []);
  const cycleRows = dashboard.cycleSummary?.byClient ?? [];
  const cycleRowsById = new Map(cycleRows.map((item) => [item.clientId, item]));

  const pendingClients = clients
    .filter((client) => !todaysClientIds.has(client.id))
    .map((client) => ({
      id: client.id,
      title: client.name,
      detail: 'Ainda sem lançamento no dia de hoje.',
    }));

  const closingSoonClients = clients
    .filter((client) => client.lockDay)
    .map((client) => ({
      client,
      daysUntilClosing: getDaysUntilNextClosing(client.lockDay as number, currentDate),
    }))
    .filter((item) => item.daysUntilClosing >= 0 && item.daysUntilClosing <= 5)
    .sort((a, b) => a.daysUntilClosing - b.daysUntilClosing)
    .map((item) => ({
      id: item.client.id,
      title: item.client.name,
      detail: `Fechamento programado para o dia ${String(item.client.lockDay).padStart(2, '0')}.`,
      badge: item.daysUntilClosing === 0 ? 'Fecha hoje' : `${item.daysUntilClosing} dia(s)`,
    }));

  const unusedAllocations = clients
    .filter((client) => {
      const cycle = cycleRowsById.get(client.id);
      return cycle
        ? cycle.closedCycle.targetMinutes > 0 && cycle.closedCycle.workedMinutes === 0
        : false;
    })
    .map((client) => ({
      id: client.id,
      title: client.name,
      detail: 'Existe meta no ciclo fechado, mas nenhum lançamento foi registrado.',
    }));

  const cycleItems = cycleRows
    .filter(
      (item) =>
        item.closedCycle.workedMinutes > 0 ||
        item.closedCycle.targetMinutes > 0 ||
        item.nextCyclePreview.workedMinutes > 0
    )
    .slice(0, 5)
    .map((item) => ({
      id: item.clientId,
      title: item.clientName,
      detail: `Fechado ${formatRangeLabel(item.closedCycle.startDate, item.closedCycle.endDate)} · Prévia ${formatRangeLabel(item.nextCyclePreview.startDate, item.nextCyclePreview.endDate)}`,
      badge:
        item.closedCycle.overtimeMinutes > 0
          ? `Extra ${formatMinutes(item.closedCycle.overtimeMinutes)}`
          : item.nextCyclePreview.workedMinutes > 0
            ? `Prévia ${formatMinutes(item.nextCyclePreview.workedMinutes)}`
            : undefined,
    }));

  const feedItems = [
    ...closingSoonClients.slice(0, 2).map((item) => ({
      id: `closing-${item.id}`,
      title: `${item.title} com fechamento próximo`,
      detail: item.detail,
      badge: item.badge,
    })),
    ...pendingClients.slice(0, 2).map((item) => ({
      id: `pending-${item.id}`,
      title: `${item.title} sem lançamento hoje`,
      detail: item.detail,
    })),
    ...unusedAllocations.slice(0, 2).map((item) => ({
      id: `unused-${item.id}`,
      title: `Alocação sem uso em ${item.title}`,
      detail: item.detail,
    })),
  ].slice(0, 5);

  return { cycleItems, pendingClients, closingSoonClients, unusedAllocations, feedItems };
};
