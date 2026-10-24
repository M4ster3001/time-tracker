import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MANAGER_DASHBOARD_AUTO_REFRESH_MS } from './constants';
import AppShell from '../../../components/AppShell';
import {
  DashboardListCard,
  DashboardStatCard,
  DashboardTimeline,
} from '../../../components/DashboardPanels';
import InfoTooltip from '../../../components/InfoTooltip';
import Pagination from '../../../components/Pagination';
import DailyStackedBars, { DailyBucket } from '../../../components/DailyStackedBars';
import api from '../../../services/api';
import { isAbortError } from '../../../utils/abort';
import { formatMinutes, monthOptions } from '../../../utils/formatters';
import {
  getCurrentMonthRange,
  getCurrentWorkWeekRange,
  getLastMonthRange,
  getLastWorkWeekRange,
  getTodayRange,
} from '../../../utils/dateRanges';
import { buildWeekTimeline, getDaysUntilClosing, sumTimelinePoints } from './mappers';
import { useStoredDashboardViewMode } from './hooks';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useLocalStorageState } from '../../../hooks/useLocalStorageState';
import type { ClientOption, ConsultantOption, ManagerDashboardResponse } from './types';

const isLayoutMode = (value: string): value is 'simple' | 'complete' =>
  value === 'simple' || value === 'complete';

const DashboardManagerPage: React.FC = () => {
  const navigate = useNavigate();
  const now = new Date();
  const defaultWorkWeekRange = getCurrentWorkWeekRange(now);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dailyStartDate, setDailyStartDate] = useState(defaultWorkWeekRange.start);
  const [dailyEndDate, setDailyEndDate] = useState(defaultWorkWeekRange.end);
  const [consultantId, setConsultantId] = useState<number>(0);
  const [clientId, setClientId] = useState<number>(0);
  const [viewMode, setViewMode] = useStoredDashboardViewMode();
  const [sectionMode, setSectionMode] = useState<'overview' | 'daily'>('overview');
  const [layoutMode, setLayoutMode] = useLocalStorageState(
    'dashboardManagerLayoutMode',
    'complete',
    isLayoutMode
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
  const [dashboard, setDashboard] = useState<ManagerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastAutoRefreshAt, setLastAutoRefreshAt] = useState<Date | null>(null);
  const lastSectionModeRef = useRef<'overview' | 'daily'>('overview');
  const dashboardRequestId = useRef(0);
  const dashboardSignatureRef = useRef('');
  const dashboardParamsRef = useRef({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    consultantId: 0,
    clientId: 0,
  });
  const clientsRequestId = useRef(0);
  const consultantsRequestId = useRef(0);

  const years = useMemo(() => [year - 1, year, year + 1], [year]);
  const quickRanges = useMemo(
    () => [
      { key: 'current-week', label: 'Semana atual', range: getCurrentWorkWeekRange() },
      { key: 'last-week', label: 'Última semana', range: getLastWorkWeekRange() },
      { key: 'current-month', label: 'Mês atual', range: getCurrentMonthRange() },
      { key: 'last-month', label: 'Último mês', range: getLastMonthRange() },
    ],
    []
  );

  const fetchDashboard = async (
    params: {
      year: number;
      month: number;
      consultantId: number;
      clientId: number;
      startDate?: string;
      endDate?: string;
    },
    options?: { background?: boolean; signal?: AbortSignal }
  ) => {
    const requestId = dashboardRequestId.current + 1;
    dashboardRequestId.current = requestId;
    dashboardParamsRef.current = params;
    if (!options?.background) {
      setLoading(true);
      setError(null);
      setDashboard(null);
    }
    try {
      if (sectionMode === 'daily' && params.startDate && params.endDate) {
        const start = new Date(`${params.startDate}T00:00:00`);
        const end = new Date(`${params.endDate}T00:00:00`);
        const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000);
        if (diffDays > 31) {
          if (!options?.background) {
            setError('O período máximo para o dia a dia é de 31 dias.');
            setLoading(false);
          }
          return;
        }
      }
      const response = await api.get('/api/dashboards/manager', {
        params: {
          month: params.month,
          year: params.year,
          consultantId: params.consultantId || undefined,
          clientId: params.clientId || undefined,
          startDate: params.startDate,
          endDate: params.endDate,
        },
        signal: options?.signal,
      });
      if (requestId !== dashboardRequestId.current) return;
      if (dashboardParamsRef.current !== params) return;
      const nextDashboard = response.data.data as ManagerDashboardResponse;
      const nextSignature = JSON.stringify(nextDashboard);
      if (nextSignature !== dashboardSignatureRef.current) {
        setDashboard(nextDashboard);
        dashboardSignatureRef.current = nextSignature;
      }
      if (options?.background) {
        setLastAutoRefreshAt(new Date());
      }
    } catch (err) {
      if (isAbortError(err)) return;
      if (requestId !== dashboardRequestId.current) return;
      if (dashboardParamsRef.current !== params) return;
      if (!options?.background) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard');
      }
    } finally {
      if (
        !options?.background &&
        requestId === dashboardRequestId.current &&
        dashboardParamsRef.current === params
      ) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboard(
      {
        year,
        month,
        consultantId,
        clientId,
        startDate: sectionMode === 'daily' ? dailyStartDate : undefined,
        endDate: sectionMode === 'daily' ? dailyEndDate : undefined,
      },
      { signal: controller.signal }
    );
    return () => controller.abort();
  }, [month, year, consultantId, clientId, sectionMode, dailyStartDate, dailyEndDate]);

  useEffect(() => {
    if (lastSectionModeRef.current !== 'daily' && sectionMode === 'daily') {
      const range = getCurrentWorkWeekRange();
      setDailyStartDate(range.start);
      setDailyEndDate(range.end);
    }
    lastSectionModeRef.current = sectionMode;
  }, [sectionMode]);

  useAutoRefresh(
    () =>
      fetchDashboard(
        {
          year,
          month,
          consultantId,
          clientId,
          startDate: sectionMode === 'daily' ? dailyStartDate : undefined,
          endDate: sectionMode === 'daily' ? dailyEndDate : undefined,
        },
        { background: true }
      ),
    MANAGER_DASHBOARD_AUTO_REFRESH_MS,
    [month, year, consultantId, clientId, sectionMode, dailyStartDate, dailyEndDate]
  );

  const dashboardConsultants = dashboard?.consultants ?? [];
  const computeConsultantTarget = (consultant: (typeof dashboardConsultants)[number]) => {
    const targetMinutes = consultant.targetMinutes;
    if (targetMinutes > 0) return Math.round((targetMinutes / 60) * 100) / 100;
    return consultant.targetHours;
  };
  const filteredConsultants = useMemo(() => {
    if (clientId === 0) return dashboardConsultants;
    return dashboardConsultants
      .map((consultant) => {
        const match = consultant.byClient.find((client) => client.clientId === clientId);
        if (!match) return null;
        const totalHours = match.hours;
        const overtimeMinutes =
          consultant.overtimeByClient.find((client) => client.clientId === clientId)
            ?.overtimeMinutes ?? 0;
        const normalHours = Math.max(0, totalHours - overtimeMinutes / 60);
        const targetHours = match.targetMinutes
          ? Math.round((match.targetMinutes / 60) * 100) / 100
          : computeConsultantTarget(consultant);
        const progressPercent =
          targetHours > 0 ? Math.round((normalHours / targetHours) * 10000) / 100 : 0;
        return {
          ...consultant,
          totalHours,
          overtimeMinutes,
          targetHours,
          progressPercent,
          byClient: [match],
        };
      })
      .filter(Boolean) as typeof dashboardConsultants;
  }, [dashboardConsultants, clientId]);

  const consultantsWithTargets = useMemo(
    () =>
      filteredConsultants.map((consultant) => {
        const targetHours = computeConsultantTarget(consultant);
        return {
          ...consultant,
          targetHours,
          progressPercent:
            targetHours > 0
              ? Math.round(
                  (Math.max(0, consultant.totalHours - consultant.overtimeMinutes / 60) /
                    targetHours) *
                    10000
                ) / 100
              : 0,
        };
      }),
    [filteredConsultants]
  );

  const totalHours = useMemo(
    () =>
      consultantsWithTargets.reduce(
        (acc, consultant) =>
          acc +
          (consultant.cycleSummary?.totals.closedCycle.workedMinutes ?? consultant.totalMinutes) /
            60,
        0
      ),
    [consultantsWithTargets]
  );
  const totalTarget = useMemo(
    () =>
      consultantsWithTargets.reduce(
        (acc, consultant) =>
          acc +
          (consultant.cycleSummary?.totals.closedCycle.targetMinutes ?? consultant.targetMinutes) /
            60,
        0
      ),
    [consultantsWithTargets]
  );
  const totalOvertime = useMemo(
    () =>
      consultantsWithTargets.reduce(
        (acc, consultant) =>
          acc +
          (consultant.cycleSummary?.totals.closedCycle.overtimeMinutes ??
            consultant.overtimeMinutes),
        0
      ),
    [consultantsWithTargets]
  );
  const previewOvertime = useMemo(
    () =>
      consultantsWithTargets.reduce(
        (acc, consultant) =>
          acc + (consultant.cycleSummary?.totals.nextCyclePreview.overtimeMinutes ?? 0),
        0
      ),
    [consultantsWithTargets]
  );
  const totalNormalHours = Math.max(0, totalHours - totalOvertime / 60);
  const progress = totalTarget > 0 ? Math.round((totalNormalHours / totalTarget) * 10000) / 100 : 0;
  const totalPages = Math.max(1, Math.ceil(consultantsWithTargets.length / pageSize));
  const paginatedConsultants = useMemo(() => {
    const start = (page - 1) * pageSize;
    return consultantsWithTargets.slice(start, start + pageSize);
  }, [consultantsWithTargets, page, pageSize]);

  const dailyForView = useMemo(() => {
    if (!dashboard) return [];
    if (consultantId) {
      const selected = dashboard.consultants.find((consultant) => consultant.id === consultantId);
      return selected?.daily ?? [];
    }
    const dailyMap = new Map<string, Map<number, DailyBucket['clients'][number]>>();
    dashboard.consultants.forEach((consultant) => {
      consultant.daily.forEach((day) => {
        const clientMap = dailyMap.get(day.date) ?? new Map();
        day.clients.forEach((client) => {
          const current = clientMap.get(client.clientId) ?? {
            clientId: client.clientId,
            clientName: client.clientName,
            minutes: 0,
            entries: [],
          };
          current.minutes += client.minutes;
          current.entries.push(...client.entries);
          clientMap.set(client.clientId, current);
        });
        dailyMap.set(day.date, clientMap);
      });
    });
    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([date, clientsMap]) => ({
        date,
        totalMinutes: Array.from(clientsMap.values()).reduce((acc, item) => acc + item.minutes, 0),
        clients: Array.from(clientsMap.values()),
      }));
  }, [dashboard, consultantId]);
  const weeklyTimeline = useMemo(() => buildWeekTimeline(dailyForView, 0), [dailyForView]);
  const previousWeeklyTimeline = useMemo(() => buildWeekTimeline(dailyForView, 1), [dailyForView]);
  const weeklyComparison = useMemo(() => {
    const current = sumTimelinePoints(weeklyTimeline);
    const previous = sumTimelinePoints(previousWeeklyTimeline);
    return { current, previous, delta: current - previous };
  }, [previousWeeklyTimeline, weeklyTimeline]);
  const teamInsights = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayBucket = dailyForView.find((day) => day.date === todayKey);
    const todaysClientIds = new Set(todayBucket?.clients.map((client) => client.clientId) ?? []);
    const clientsWithoutToday = clients
      .filter((client) => !todaysClientIds.has(client.id))
      .map((client) => ({
        id: client.id,
        title: client.name,
        detail: 'Nenhum consultor registrou horas neste cliente hoje.',
      }));
    const closingSoon = clients
      .filter((client) => client.lockDay)
      .map((client) => ({
        client,
        daysUntilClosing: getDaysUntilClosing(client.lockDay as number, new Date()),
      }))
      .filter((item) => item.daysUntilClosing >= 0 && item.daysUntilClosing <= 5)
      .sort((a, b) => a.daysUntilClosing - b.daysUntilClosing)
      .map((item) => ({
        id: item.client.id,
        title: item.client.name,
        detail: `Fechamento no dia ${String(item.client.lockDay).padStart(2, '0')}.`,
        badge: item.daysUntilClosing === 0 ? 'Fecha hoje' : `${item.daysUntilClosing} dia(s)`,
      }));
    const allocationsWithoutUse = clients
      .map((client) => {
        const usedMinutes = consultantsWithTargets.reduce((acc, consultant) => {
          const match = consultant.byClient.find((item) => item.clientId === client.id);
          return acc + Math.round((match?.hours ?? 0) * 60);
        }, 0);
        const allocatedMinutes = consultantsWithTargets.reduce((acc, consultant) => {
          const match = consultant.byClient.find((item) => item.clientId === client.id);
          return acc + (match?.targetMinutes ?? 0);
        }, 0);
        return { client, usedMinutes, allocatedMinutes };
      })
      .filter((item) => item.allocatedMinutes > 0 && item.usedMinutes === 0)
      .map((item) => ({
        id: item.client.id,
        title: item.client.name,
        detail: 'Existe meta alocada, mas o time ainda não usou este cliente no ciclo fechado.',
      }));
    const feedItems = [
      ...closingSoon.slice(0, 2).map((item) => ({
        id: `closing-${item.id}`,
        title: `${item.title} com fechamento próximo`,
        detail: item.detail,
        badge: item.badge,
      })),
      ...clientsWithoutToday.slice(0, 2).map((item) => ({
        id: `pending-${item.id}`,
        title: `${item.title} sem lançamento hoje`,
        detail: item.detail,
      })),
      ...allocationsWithoutUse.slice(0, 2).map((item) => ({
        id: `unused-${item.id}`,
        title: `Alocação sem uso em ${item.title}`,
        detail: item.detail,
      })),
    ].slice(0, 5);

    return { clientsWithoutToday, closingSoon, allocationsWithoutUse, feedItems };
  }, [clients, consultantsWithTargets, dailyForView]);

  const fetchClients = async () => {
    const requestId = clientsRequestId.current + 1;
    clientsRequestId.current = requestId;
    try {
      const response = await api.get('/api/manager/clients', {
        params: { year, month },
      });

      if (requestId !== clientsRequestId.current) return;
      setClients(response.data.data || []);
    } catch (_err) {
      if (requestId !== clientsRequestId.current) return;
      setClients([]);
    }
  };

  const fetchConsultants = async (selectedClientId?: number) => {
    const requestId = consultantsRequestId.current + 1;
    consultantsRequestId.current = requestId;
    try {
      const response = await api.get('/api/manager/consultants', {
        params: {
          clientId: selectedClientId || undefined,
          year,
          month,
        },
      });

      if (requestId !== consultantsRequestId.current) return;
      setConsultants(response.data.data || []);
    } catch (_err) {
      if (requestId !== consultantsRequestId.current) return;
      setConsultants([]);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchConsultants();
  }, [year, month]);

  useEffect(() => {
    fetchConsultants(clientId || undefined);
  }, [clientId, year, month]);

  useEffect(() => {
    if (clients.length === 0) {
      if (clientId !== 0) setClientId(0);
      return;
    }
    if (clientId === 0) return;
    const exists = clients.some((client) => client.id === clientId);
    if (!exists) setClientId(0);
  }, [clients, clientId]);

  useEffect(() => {
    if (consultants.length === 0) {
      if (consultantId !== 0) setConsultantId(0);
      return;
    }
    if (consultantId === 0) return;
    const exists = consultants.some((consultant) => consultant.id === consultantId);
    if (!exists) setConsultantId(0);
  }, [consultants, consultantId]);

  useEffect(() => {
    setPage(1);
  }, [year, month, clientId, consultantId, viewMode]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <AppShell
      title={translateUi('Dashboard do Time')}
      subtitle={translateUi('Acompanhe o progresso dos consultores')}
    >
      <section className="animate-fade-up rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
              {translateUi('Filtros')}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-tt-text">
              {translateUi('Periodo e consultor')}
            </h3>
            <p className="mt-1 text-xs text-tt-text-muted">
              {translateUi('Auto refresh: 1 min')}{' '}
              {lastAutoRefreshAt
                ? ` · Última verificação ${lastAutoRefreshAt.toLocaleTimeString('pt-BR')}`
                : ''}
            </p>
          </div>
          <div className="tt-filter-controls">
            <div className="tt-filter-cluster">

            {sectionMode === 'overview' ? (
              <>
                <select
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
                >
                  {years.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <input
                  type="date"
                  value={dailyStartDate}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDailyStartDate(next);
                    if (next > dailyEndDate) {
                      setDailyEndDate(next);
                    }
                  }}
                  className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
                />
                <input
                  type="date"
                  value={dailyEndDate}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDailyEndDate(next);
                    if (next < dailyStartDate) {
                      setDailyStartDate(next);
                    }
                  }}
                  className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const range = getTodayRange();
                    setDailyStartDate(range.start);
                    setDailyEndDate(range.end);
                  }}
                  className="rounded-2xl border border-tt-border px-3 py-2 text-xs font-semibold text-tt-warning hover:bg-tt-warning-soft"
                >
                  {translateUi('Hoje')}
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {quickRanges.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setDailyStartDate(item.range.start);
                        setDailyEndDate(item.range.end);
                      }}
                      className="rounded-full border border-tt-border px-3 py-1 text-[11px] font-semibold text-tt-warning hover:bg-tt-warning-soft"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <select
              value={clientId}
              onChange={(event) => setClientId(Number(event.target.value))}
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
            >
              <option value={0}>{translateUi('Todos os clientes')}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <select
              value={consultantId}
              onChange={(event) => setConsultantId(Number(event.target.value))}
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
              disabled={consultants.length === 0}
            >
              <option value={0}>{translateUi('Todos os consultores')}</option>
              {consultants.map((consultant) => (
                <option key={consultant.id} value={consultant.id}>
                  {consultant.name}
                </option>
              ))}
            </select>
            </div>
            <div className="tt-filter-toggles">
            <div className="flex items-center gap-2 rounded-full border border-tt-border bg-tt-surface px-2 py-1 text-xs">
              <button
                type="button"
                onClick={() => setSectionMode('overview')}
                className={`rounded-full px-3 py-1 ${
                  sectionMode === 'overview'
                    ? 'bg-tt-elevated text-tt-warning'
                    : 'text-tt-text-muted'
                }`}
              >
                {translateUi('Visao geral')}
              </button>
              <button
                type="button"
                onClick={() => setSectionMode('daily')}
                className={`rounded-full px-3 py-1 ${
                  sectionMode === 'daily' ? 'bg-tt-elevated text-tt-warning' : 'text-tt-text-muted'
                }`}
              >
                {translateUi('Dia a dia')}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-tt-border bg-tt-surface px-2 py-1 text-xs">
              <button
                type="button"
                onClick={() => setLayoutMode('simple')}
                className={`rounded-full px-3 py-1 ${
                  layoutMode === 'simple' ? 'bg-tt-elevated text-tt-warning' : 'text-tt-text-muted'
                }`}
              >
                {translateUi('Visual simples')}
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('complete')}
                className={`rounded-full px-3 py-1 ${
                  layoutMode === 'complete'
                    ? 'bg-tt-elevated text-tt-warning'
                    : 'text-tt-text-muted'
                }`}
              >
                {translateUi('Visual completo')}
              </button>
            </div>
            {sectionMode === 'overview' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${
                    viewMode === 'cards'
                      ? 'bg-tt-action text-tt-on-action'
                      : 'border border-tt-border text-tt-warning'
                  }`}
                >
                  {translateUi('Cards')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${
                    viewMode === 'list'
                      ? 'bg-tt-action text-tt-on-action'
                      : 'border border-tt-border text-tt-warning'
                  }`}
                >
                  {translateUi('Lista')}
                </button>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-tt border border-tt-border bg-tt-surface p-10 text-center text-tt-text-muted">
          {translateUi('Carregando dashboard...')}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-tt-danger bg-tt-danger-soft p-6 text-sm text-tt-danger">
          {error}
        </div>
      ) : sectionMode === 'daily' ? (
        <DailyStackedBars
          data={dailyForView}
          selectedClientId={clientId || undefined}
          defaultScale="day"
          storageKey="dailyScale:manager"
        />
      ) : (
        <section className="tt-page-stack animate-fade-up">
          <div className="tt-metric-grid tt-metric-grid--auto">
            <DashboardStatCard
              label={translateUi('Horas normais')}
              value={formatMinutes(Math.round(totalNormalHours * 60))}
              description="Entregue dentro da meta consolidada do ciclo fechado."
              tone="success"
            />
            <DashboardStatCard
              label={translateUi('Horas extras')}
              value={formatMinutes(Math.round(totalOvertime))}
              description="Excedente já fechado e pronto para ação do manager."
              tone="warning"
            />
            <DashboardStatCard
              label={translateUi('Ciclo fechado')}
              value={formatMinutes(Math.round(totalTarget * 60))}
              description="Meta esperada do bloco já encerrado."
              tone="info"
            />
            <DashboardStatCard
              label={translateUi('Previa do proximo ciclo')}
              value={formatMinutes(Math.round(previewOvertime))}
              description="Extras que já estão aparecendo na janela em andamento."
              tone={previewOvertime > 0 ? 'warning' : 'default'}
            />
            <DashboardStatCard
              label={translateUi('Progresso')}
              value={`${progress}%`}
              description="Baseado apenas no ciclo que já fechou."
            />
          </div>

          {layoutMode === 'complete' ? (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-tt-info bg-tt-info-soft px-4 py-3 text-sm text-tt-info">
                <span className="font-semibold">{translateUi('Leitura operacional do time')}</span>
                <InfoTooltip content="O ciclo fechado consolida o que já pode ser cobrado e analisado. A prévia do próximo ciclo existe para antecipar risco, sem misturar com o que ainda não fechou." />
              </div>

              <div className="tt-panel-grid xl:grid-cols-3">
                <DashboardListCard
                  title={translateUi('Clientes sem lancamento hoje')}
                  description="Clientes esperados hoje, mas ainda sem registro no time."
                  items={teamInsights.clientsWithoutToday}
                  emptyMessage="Nenhum cliente pendente hoje."
                />
                <DashboardListCard
                  title={translateUi('Fechamento proximo')}
                  description="Clientes que exigem atenção nos próximos dias."
                  items={teamInsights.closingSoon}
                  emptyMessage="Nenhum fechamento próximo."
                />
                <DashboardListCard
                  title={translateUi('Alocacoes sem uso')}
                  description="Meta alocada, mas sem uso no ciclo fechado."
                  items={teamInsights.allocationsWithoutUse}
                  emptyMessage="Nenhuma alocação sem uso no ciclo fechado."
                />
              </div>

              <DashboardTimeline
                title={translateUi('Linha do tempo semanal')}
                description="Volume diário do time nos últimos 7 dias carregados."
                points={weeklyTimeline}
                footer={`Semana atual: ${formatMinutes(weeklyComparison.current)} · Semana anterior: ${formatMinutes(weeklyComparison.previous)} · Variacao: ${weeklyComparison.delta >= 0 ? '+' : ''}${formatMinutes(Math.abs(weeklyComparison.delta))}`}
              />

              <DashboardListCard
                title={translateUi('Feed relevante')}
                description="Sinais de operacao para agir antes do fechamento."
                items={teamInsights.feedItems}
                emptyMessage="Nenhum sinal relevante por enquanto."
              />
            </>
          ) : null}

          {filteredConsultants.length === 0 ? (
            <div className="rounded-tt border border-tt-border bg-tt-surface p-6 text-sm text-tt-text-muted">
              {translateUi('Nenhum consultor encontrado para este periodo.')}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="tt-panel-grid lg:grid-cols-2">
              {paginatedConsultants.map((consultant) => (
                <div
                  key={consultant.id}
                  className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
                        {translateUi('Consultor')}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-tt-text">{consultant.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {consultant.overtimeMinutes > 0 ? (
                        <span className="rounded-full bg-tt-elevated px-3 py-1 text-xs font-semibold text-tt-warning">
                          {translateUi('Extras')}{' '}
                          {formatMinutes(Math.round(consultant.overtimeMinutes))}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-tt-success-soft px-3 py-1 text-xs font-semibold text-tt-success">
                        {consultant.progressPercent}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/manager/consultants?consultantId=${consultant.id}`)}
                      className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning hover:bg-tt-warning-soft"
                    >
                      {translateUi('Editar alocacao')}
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-tt-text-muted">
                        {translateUi('Total')}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-tt-text">
                        {formatMinutes(Math.round(consultant.totalHours * 60))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-tt-text-muted">
                        {translateUi('Meta')}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-tt-text">
                        {formatMinutes(Math.round(consultant.targetHours * 60))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-tt-text-muted">
                      {translateUi('Horas por cliente')}
                    </p>
                    <div className="mt-3 space-y-3">
                      {consultant.byClient.length === 0 ? (
                        <p className="text-sm text-tt-text-muted">
                          {translateUi('Sem lancamentos.')}
                        </p>
                      ) : (
                        consultant.byClient.map((client) => (
                          <div key={client.clientId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="max-w-[160px] truncate text-sm text-tt-text"
                                title={client.clientName}
                              >
                                {client.clientName}
                              </span>
                              {!client.paysOvertime ? (
                                <span className="rounded-full bg-tt-danger-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-tt-danger">
                                  {translateUi('Sem extra')}
                                </span>
                              ) : null}
                            </div>
                            <span className="text-sm font-semibold text-tt-action">
                              {formatMinutes(Math.round(client.hours * 60))}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {consultant.overtimeByClient.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-tt-border bg-tt-warning-soft/70 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
                        {translateUi('Extras por cliente')}
                      </p>
                      <div className="mt-2 space-y-2 text-sm text-tt-warning">
                        {consultant.overtimeByClient.map((client) => (
                          <div key={client.clientId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="max-w-[160px] truncate" title={client.clientName}>
                                {client.clientName}
                              </span>
                              {!client.paysOvertime ? (
                                <span
                                  title={translateUi('Cliente nao paga hora extra')}
                                  className="rounded-full bg-tt-danger-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-tt-danger"
                                >
                                  {translateUi('Sem extra')}
                                </span>
                              ) : null}
                            </div>
                            <span className="font-semibold">
                              {formatMinutes(Math.round(client.overtimeMinutes))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
              <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[720px] text-left text-sm text-tt-text">
                  <thead className="sticky top-0 bg-tt-surface">
                    <tr className="text-xs uppercase tracking-[0.2em] text-tt-warning">
                      <th className="px-2 py-3">{translateUi('Consultor')}</th>
                      <th className="px-2 py-3">{translateUi('Total')}</th>
                      <th className="px-2 py-3">{translateUi('Meta')}</th>
                      <th className="px-2 py-3">{translateUi('Progresso')}</th>
                      <th className="px-2 py-3">{translateUi('Acoes')}</th>
                      <th className="px-2 py-3">{translateUi('Clientes')}</th>
                      <th className="px-2 py-3">{translateUi('Extras')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedConsultants.map((consultant) => (
                      <tr key={consultant.id} className="border-t border-tt-border">
                        <td
                          className="px-2 py-3 font-semibold text-tt-text"
                          title={consultant.name}
                        >
                          {consultant.name}
                        </td>
                        <td className="px-2 py-3">
                          {formatMinutes(Math.round(consultant.totalHours * 60))}
                        </td>
                        <td className="px-2 py-3">
                          {formatMinutes(Math.round(consultant.targetHours * 60))}
                        </td>
                        <td className="px-2 py-3">{consultant.progressPercent}%</td>
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/manager/consultants?consultantId=${consultant.id}`)
                            }
                            className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning hover:bg-tt-warning-soft"
                          >
                            {translateUi('Editar alocacao')}
                          </button>
                        </td>
                        <td
                          className="px-2 py-3 text-xs text-tt-text-muted"
                          title={consultant.byClient
                            .map(
                              (client) =>
                                `${client.clientName} (${formatMinutes(
                                  Math.round(client.hours * 60)
                                )})${client.paysOvertime ? '' : '[sem extra]'}`
                            )
                            .join(', ')}
                        >
                          <span className="block max-w-[280px] truncate">
                            {consultant.byClient
                              .map(
                                (client) =>
                                  `${client.clientName} (${formatMinutes(
                                    Math.round(client.hours * 60)
                                  )})${client.paysOvertime ? '' : '[sem extra]'}`
                              )
                              .join(', ') || 'Sem lançamentos'}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-sm font-semibold text-tt-warning">
                          {consultant.overtimeMinutes > 0 ? (
                            <span
                              title={consultant.overtimeByClient
                                .map(
                                  (client) =>
                                    `${client.clientName}: ${formatMinutes(
                                      Math.round(client.overtimeMinutes)
                                    )}${client.paysOvertime ? '' : '(sem extra)'}`
                                )
                                .join(', ')}
                            >
                              {formatMinutes(Math.round(consultant.overtimeMinutes))}
                            </span>
                          ) : (
                            '-'
                          )}
                          {consultant.overtimeByClient.some((client) => !client.paysOvertime) ? (
                            <span className="ml-2 rounded-full bg-tt-danger-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-tt-danger">
                              {translateUi('Sem extra')}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredConsultants.length > 0 ? (
            <Pagination
              total={filteredConsultants.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </section>
      )}
    </AppShell>
  );
};

export default DashboardManagerPage;
