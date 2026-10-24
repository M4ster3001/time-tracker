import { text, translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../../../components/AppShell';
import DailyStackedBars from '../../../components/DailyStackedBars';
import ScreenState from '../../../components/ScreenState';
import StateBanner from '../../../components/StateBanner';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { formatMinutes, monthOptions } from '../../../utils/formatters';
import {
  getCurrentMonthRange,
  getCurrentWorkWeekRange,
  getLastMonthRange,
  getLastWorkWeekRange,
  getTodayRange,
} from '../../../utils/dateRanges';
import { isAbortError } from '../../../utils/abort';
import { fetchAdminDashboardData } from './services/dashboardAdmin.service';
import type { AdminDashboardResponse } from './types/dashboardAdmin.types';

const DashboardAdminPage: React.FC = () => {
  const AUTO_REFRESH_MS = 60_000;
  const now = new Date();
  const defaultWorkWeekRange = getCurrentWorkWeekRange(now);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dailyStartDate, setDailyStartDate] = useState(defaultWorkWeekRange.start);
  const [dailyEndDate, setDailyEndDate] = useState(defaultWorkWeekRange.end);
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [sectionMode, setSectionMode] = useState<'overview' | 'daily'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastAutoRefreshAt, setLastAutoRefreshAt] = useState<Date | null>(null);
  const lastSectionModeRef = useRef<'overview' | 'daily'>('overview');
  const dashboardSignature = useMemo(
    () => (dashboard ? JSON.stringify(dashboard) : ''),
    [dashboard]
  );

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

  const fetchDashboard = async (options?: { background?: boolean; signal?: AbortSignal }) => {
    if (!options?.background) {
      setLoading(true);
      setError(null);
    }
    try {
      if (sectionMode === 'daily') {
        const start = new Date(`${dailyStartDate}T00:00:00`);
        const end = new Date(`${dailyEndDate}T00:00:00`);
        const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000);
        if (diffDays > 31) {
          if (!options?.background) {
            setError('O período máximo para o dia a dia é de 31 dias.');
            setLoading(false);
          }
          return;
        }
      }
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEndDate = new Date(year, month, 0);
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(
        monthEndDate.getDate()
      ).padStart(2, '0')}`;
      const nextDashboard = await fetchAdminDashboardData({
        month,
        year,
        dailyStartDate: sectionMode === 'daily' ? dailyStartDate : monthStart,
        dailyEndDate: sectionMode === 'daily' ? dailyEndDate : monthEnd,
        signal: options?.signal,
      });
      const nextSignature = JSON.stringify(nextDashboard);
      if (nextSignature !== dashboardSignature) {
        setDashboard(nextDashboard);
      }
      if (options?.background) {
        setLastAutoRefreshAt(new Date());
      }
    } catch (err) {
      if (isAbortError(err)) return;
      if (!options?.background) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard');
      }
    } finally {
      if (!options?.background && !options?.signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboard({ signal: controller.signal });
    return () => controller.abort();
  }, [month, year, sectionMode, dailyStartDate, dailyEndDate]);

  useEffect(() => {
    if (lastSectionModeRef.current !== 'daily' && sectionMode === 'daily') {
      const range = getCurrentWorkWeekRange();
      setDailyStartDate(range.start);
      setDailyEndDate(range.end);
    }
    lastSectionModeRef.current = sectionMode;
  }, [sectionMode]);

  useAutoRefresh(() => fetchDashboard({ background: true }), AUTO_REFRESH_MS, [
    month,
    year,
    sectionMode,
    dailyStartDate,
    dailyEndDate,
    dashboardSignature,
  ]);

  return (
    <AppShell
      title={translateUi('Dashboard Admin')}
      subtitle={translateUi('Visao geral do sistema')}
    >
      <section className="animate-fade-up rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
              {translateUi('Filtros')}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-tt-text">
              {translateUi('Periodo do mes')}
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
            </div>
          </div>
        </div>
      </section>

      {lastAutoRefreshAt ? (
        <StateBanner
          tone="info"
          message={`Última verificação automática: ${lastAutoRefreshAt.toLocaleTimeString('pt-BR')}`}
          className="text-xs"
        />
      ) : null}

      {loading ? (
        <ScreenState
          variant="loading"
          title={translateUi('Carregando dashboard')}
          description="Buscando os dados mais recentes do sistema."
          className="min-h-[240px]"
        />
      ) : error ? (
        <ScreenState
          variant="error"
          title={translateUi('Nao foi possivel carregar o dashboard')}
          description={error}
          action={{ label: translateUi('Tentar novamente'), onClick: () => fetchDashboard() }}
        />
      ) : dashboard ? (
        sectionMode === 'daily' ? (
          <DailyStackedBars
            data={dashboard.daily}
            defaultScale="day"
            storageKey="dailyScale:admin"
          />
        ) : (
          <section className="tt-page-stack animate-fade-up">
            {(() => {
              const closed = dashboard.cycleSummary?.totals.closedCycle;
              const preview = dashboard.cycleSummary?.totals.nextCyclePreview;
              const totalWorked = closed
                ? closed.workedMinutes
                : Math.round(dashboard.totalHours * 60);
              const totalTarget = closed
                ? closed.targetMinutes
                : Math.round(dashboard.targetHours * 60);
              const totalNormal = closed
                ? closed.normalMinutes
                : totalWorked - dashboard.overtimeMinutes;
              const totalOvertime = closed ? closed.overtimeMinutes : dashboard.overtimeMinutes;
              const progressPercent =
                totalTarget > 0 ? Math.round((totalNormal / totalTarget) * 10000) / 100 : 0;
              return (
                <div className="tt-metric-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                  {[
                    { label: translateUi('Consultores'), value: dashboard.totalConsultants },
                    { label: 'Horas ciclo fechado', value: formatMinutes(totalWorked) },
                    { label: 'Meta ciclo fechado', value: formatMinutes(totalTarget) },
                    {
                      label: translateUi('Progresso'),
                      value: `${progressPercent}%`,
                      hint: text(
                        'Horas normais ÷ meta do ciclo fechado.',
                        'Regular hours ÷ closed-cycle target.'
                      ),
                    },
                    {
                      label: 'Extras ciclo fechado',
                      value: formatMinutes(totalOvertime),
                      hint: text(
                        'Inclui horas lançadas em clientes sem alocação (sem meta).',
                        'Includes hours logged on clients with no allocation (no target).'
                      ),
                    },
                    {
                      label: 'Extras próximo ciclo',
                      value: formatMinutes(preview?.overtimeMinutes ?? 0),
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="tt-metric-card rounded-tt border border-tt-border bg-tt-surface shadow-sm"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
                        {card.label}
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-tt-text">{card.value}</p>
                      {'hint' in card && card.hint ? (
                        <p className="mt-1 text-xs text-tt-text-muted">{card.hint}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="tt-panel-grid lg:grid-cols-2">
              <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-tt-text">
                  {translateUi('Top clientes')}
                </h3>
                <div className="mt-4 space-y-3">
                  {dashboard.topClients.length === 0 ? (
                    <p className="text-sm text-tt-text-muted">{translateUi('Sem dados.')}</p>
                  ) : (
                    dashboard.topClients.map((client, index) => (
                      <div key={client.clientId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-tt-text">
                            {index + 1}. {client.clientName}
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

              <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-tt-text">
                  {translateUi('Top consultores')}
                </h3>
                <div className="mt-4 space-y-3">
                  {dashboard.topConsultants.length === 0 ? (
                    <p className="text-sm text-tt-text-muted">{translateUi('Sem dados.')}</p>
                  ) : (
                    dashboard.topConsultants.map((consultant, index) => (
                      <div key={consultant.userId} className="flex items-center justify-between">
                        <span className="text-sm text-tt-text">
                          {index + 1}. {consultant.userName}
                        </span>
                        <span className="text-sm font-semibold text-tt-action">
                          {formatMinutes(Math.round(consultant.hours * 60))}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="tt-panel-grid lg:grid-cols-2">
              <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-tt-text">
                  {translateUi('Horas extras por cliente')}
                </h3>
                <div className="mt-4 space-y-3">
                  {dashboard.overtimeByClient.length === 0 ? (
                    <p className="text-sm text-tt-text-muted">
                      {translateUi('Sem horas extras no periodo.')}
                    </p>
                  ) : (
                    dashboard.overtimeByClient.slice(0, 5).map((client) => (
                      <div key={client.clientId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-tt-text">{client.clientName}</span>
                          {!client.paysOvertime ? (
                            <span className="rounded-full bg-tt-danger-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-tt-danger">
                              {translateUi('Sem extra')}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-sm font-semibold text-tt-warning">
                          {formatMinutes(Math.round(client.overtimeMinutes))}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-tt-text">
                  {translateUi('Horas extras por consultor')}
                </h3>
                <div className="mt-4 space-y-3">
                  {dashboard.overtimeByConsultant.length === 0 ? (
                    <p className="text-sm text-tt-text-muted">
                      {translateUi('Sem horas extras no periodo.')}
                    </p>
                  ) : (
                    dashboard.overtimeByConsultant.slice(0, 5).map((consultant) => (
                      <div key={consultant.userId} className="flex items-center justify-between">
                        <span className="text-sm text-tt-text">{consultant.userName}</span>
                        <span className="text-sm font-semibold text-tt-warning">
                          {formatMinutes(Math.round(consultant.overtimeMinutes))}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )
      ) : null}
    </AppShell>
  );
};

export default DashboardAdminPage;
