import { useAuth } from '../../../../contexts/AuthContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAutoRefresh } from '../../../../hooks/useAutoRefresh';
import { getCurrentWorkWeekRange, getTodayRange } from '../../../../utils/dateRanges';
import { formatDate, formatMinutes } from '../../../../utils/formatters';
import type {
  ActivitySuggestion,
  ClientOption,
  DashboardPersonalInsights,
  DashboardPersonalOverviewMetrics,
  DashboardResponse,
  LockStatus,
  QuickLogPayload,
} from '../types/dashboardPersonal.types';
import {
  createQuickLogEntry,
  fetchActivityTags,
  fetchAiStatus,
  fetchDashboardPersonal,
  fetchDashboardClients,
  fetchLockStatuses,
} from '../services/dashboardPersonal.service';
import {
  buildQuickLogSuggestionsFromEntries,
  buildDashboardPersonalInsights,
  buildDashboardPersonalOverviewMetrics,
  buildRecentWeekPoints,
  getPointsTotal,
} from '../mappers/dashboardPersonal.mapper';
import { getDashboardPersonalQuickRanges } from '../constants/dashboardPersonal.constants';

const AUTO_REFRESH_MS = 60_000;

export const useDashboardPersonalPage = () => {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const defaultWorkWeekRange = useMemo(() => getCurrentWorkWeekRange(now), [now]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dailyStartDate, setDailyStartDate] = useState(defaultWorkWeekRange.start);
  const [dailyEndDate, setDailyEndDate] = useState(defaultWorkWeekRange.end);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'daily'>('overview');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState<number>(0);
  const [activityTags, setActivityTags] = useState<ActivitySuggestion[]>([]);
  const [aiStatus, setAiStatus] = useState<{ enabled: boolean; provider?: string | null } | null>(
    null
  );
  const [lockByClient, setLockByClient] = useState<Record<number, LockStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastViewModeRef = useRef<'overview' | 'daily'>('overview');
  const requestIdRef = useRef(0);

  const years = useMemo(() => [year - 1, year, year + 1], [year]);
  const quickRanges = useMemo(() => getDashboardPersonalQuickRanges(), []);
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients]
  );
  const selectedLockStatus = clientId ? lockByClient[clientId] : null;
  const getEntryBasedSuggestions = useCallback(
    (selectedClientId?: number) =>
      buildQuickLogSuggestionsFromEntries(dashboard?.entries ?? [], selectedClientId),
    [dashboard]
  );

  const applyQuickRange = (start: string, end: string) => {
    setDailyStartDate(start);
    setDailyEndDate(end);
  };

  const loadDashboard = async (options?: { background?: boolean }) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!options?.background) {
      setLoading(true);
      setError(null);
    }

    try {
      if (viewMode === 'daily') {
        const start = new Date(`${dailyStartDate}T00:00:00`);
        const end = new Date(`${dailyEndDate}T00:00:00`);
        const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000);
        if (diffDays > 31) {
          setError('O período máximo para o dia a dia é de 31 dias.');
          setLoading(false);
          return;
        }
      }

      const nextDashboard = await fetchDashboardPersonal({
        month,
        year,
        startDate: viewMode === 'daily' ? dailyStartDate : undefined,
        endDate: viewMode === 'daily' ? dailyEndDate : undefined,
      });
      if (requestId !== requestIdRef.current) return;
      setDashboard(nextDashboard);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard');
    } finally {
      if (requestId === requestIdRef.current && !options?.background) {
        setLoading(false);
      }
    }
  };

  const loadClients = async () => {
    if (!user) return;
    try {
      const nextClients = await fetchDashboardClients(user.id);
      setClients(nextClients);
    } catch {
      setClients([]);
    }
  };

  const loadActivitySuggestions = useCallback(
    async (selectedClientId?: number) => {
      const suggestions = await fetchActivityTags(selectedClientId).catch(() => []);
      const nextSuggestions =
        suggestions.length > 0 ? suggestions : getEntryBasedSuggestions(selectedClientId);
      setActivityTags(nextSuggestions);
      return nextSuggestions;
    },
    [getEntryBasedSuggestions]
  );

  const loadSideData = async () => {
    const [nextTags, nextAiStatus] = await Promise.allSettled([
      fetchActivityTags(),
      fetchAiStatus(),
    ]);
    const activitySuggestions =
      nextTags.status === 'fulfilled' && nextTags.value.length > 0
        ? nextTags.value
        : getEntryBasedSuggestions();
    setActivityTags(activitySuggestions);
    setAiStatus(nextAiStatus.status === 'fulfilled' ? nextAiStatus.value : { enabled: false });
  };

  useEffect(() => {
    void loadDashboard();
    void loadSideData();
  }, [month, year, viewMode, dailyStartDate, dailyEndDate]);

  useEffect(() => {
    if (activityTags.length > 0) return;
    const fallbackSuggestions = getEntryBasedSuggestions();
    if (fallbackSuggestions.length > 0) {
      setActivityTags(fallbackSuggestions);
    }
  }, [activityTags.length, dashboard]);

  useEffect(() => {
    if (lastViewModeRef.current !== 'daily' && viewMode === 'daily') {
      const range = getCurrentWorkWeekRange();
      setDailyStartDate(range.start);
      setDailyEndDate(range.end);
    }
    lastViewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    void loadClients();
  }, [user?.id]);

  useEffect(() => {
    if (clients.length === 0) {
      if (clientId !== 0) setClientId(0);
      return;
    }
    if (clientId !== 0 && !clients.some((client) => client.id === clientId)) {
      setClientId(0);
    }
  }, [clients, clientId]);

  useAutoRefresh(() => loadDashboard({ background: true }), AUTO_REFRESH_MS, [
    month,
    year,
    viewMode,
    dailyStartDate,
    dailyEndDate,
  ]);

  useEffect(() => {
    const loadLocks = async () => {
      if (!dashboard) {
        setLockByClient({});
        return;
      }
      const uniqueClientIds = new Set(dashboard.entries.map((entry) => entry.clientId));
      if (clientId) uniqueClientIds.add(clientId);
      const ids = Array.from(uniqueClientIds);
      if (ids.length === 0) {
        setLockByClient({});
        return;
      }
      try {
        const nextLocks = await fetchLockStatuses(ids, month, year);
        setLockByClient(nextLocks);
      } catch {
        setLockByClient({});
      }
    };

    void loadLocks();
  }, [dashboard, month, year, clientId]);

  const recentWeekPoints = useMemo(
    () => (dashboard ? buildRecentWeekPoints(dashboard.daily, 0) : []),
    [dashboard]
  );
  const previousWeekPoints = useMemo(
    () => (dashboard ? buildRecentWeekPoints(dashboard.daily, 1) : []),
    [dashboard]
  );
  const weekComparison = useMemo(() => {
    const currentTotal = getPointsTotal(recentWeekPoints);
    const previousTotal = getPointsTotal(previousWeekPoints);
    return { currentTotal, previousTotal, delta: currentTotal - previousTotal };
  }, [previousWeekPoints, recentWeekPoints]);

  const overviewMetrics: DashboardPersonalOverviewMetrics = useMemo(
    () => buildDashboardPersonalOverviewMetrics(dashboard, clientId),
    [dashboard, clientId]
  );

  const overviewInsights: DashboardPersonalInsights = useMemo(
    () =>
      buildDashboardPersonalInsights({
        clients,
        dashboard,
        todayKey,
        formatRangeLabel: (startDate, endDate) =>
          `${formatDate(startDate)} - ${formatDate(endDate)}`,
        formatMinutes,
      }),
    [clients, dashboard, todayKey]
  );

  const handleQuickLog = async (payload: QuickLogPayload) => {
    await createQuickLogEntry(payload);
    await loadDashboard();
    const nextTags = await fetchActivityTags(payload.clientId).catch(() => []);
    const nextSuggestions =
      nextTags.length > 0 ? nextTags : getEntryBasedSuggestions(payload.clientId);
    setActivityTags(nextSuggestions);
  };

  return {
    month,
    setMonth,
    year,
    setYear,
    dailyStartDate,
    setDailyStartDate,
    dailyEndDate,
    setDailyEndDate,
    dashboard,
    viewMode,
    setViewMode,
    clients,
    clientId,
    setClientId,
    activityTags,
    aiStatus,
    lockByClient,
    loading,
    error,
    years,
    clientNameById,
    selectedLockStatus,
    quickRanges,
    applyQuickRange,
    recentWeekPoints,
    previousWeekPoints,
    weekComparison,
    overviewMetrics,
    overviewInsights,
    handleQuickLog,
    loadActivitySuggestions,
    reload: loadDashboard,
    todayRange: getTodayRange(),
  };
};
