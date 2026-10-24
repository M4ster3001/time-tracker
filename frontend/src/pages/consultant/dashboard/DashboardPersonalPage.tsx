import { translate as translateUi } from '../../../i18n';
import React from 'react';
import AppShell from '../../../components/AppShell';
import ScreenState from '../../../components/ScreenState';
import { SkeletonDashboard } from '../../../components/Skeleton';
import TrackingImportPanel from '../../../components/tracking/TrackingImportPanel';
import TrackingTimerWidget from '../../../components/tracking/TrackingTimerWidget';
import { useLocalStorageState } from '../../../hooks/useLocalStorageState';
import { formatMinutes } from '../../../utils/formatters';
import DashboardPersonalDailySection from './components/DashboardPersonalDailySection';
import DashboardPersonalFilters from './components/DashboardPersonalFilters';
import DashboardPersonalOverviewSection from './components/DashboardPersonalOverviewSection';
import { useDashboardPersonalPage } from './hooks/useDashboardPersonalPage';

const isLayoutMode = (value: string): value is 'simple' | 'complete' =>
  value === 'simple' || value === 'complete';

const DashboardPersonalPage: React.FC = () => {
  const [layoutMode, setLayoutMode] = useLocalStorageState(
    'dashboardPersonalLayoutMode',
    'complete',
    isLayoutMode
  );
  const {
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
    weekComparison,
    overviewMetrics,
    overviewInsights,
    handleQuickLog,
    loadActivitySuggestions,
    reload,
    todayRange,
  } = useDashboardPersonalPage();

  return (
    <AppShell
      title={translateUi('Meu Dashboard')}
      subtitle={translateUi('Sua visao de horas no mes')}
    >
      <TrackingTimerWidget className="mb-5" />
      <TrackingImportPanel className="mb-5" />
      <DashboardPersonalFilters
        viewMode={viewMode}
        layoutMode={layoutMode}
        month={month}
        year={year}
        years={years}
        clientId={clientId}
        clients={clients}
        dailyStartDate={dailyStartDate}
        dailyEndDate={dailyEndDate}
        onMonthChange={setMonth}
        onYearChange={setYear}
        onClientChange={setClientId}
        onViewModeChange={setViewMode}
        onLayoutModeChange={setLayoutMode}
        onDailyStartDateChange={(value) => {
          setDailyStartDate(value);
          if (value > dailyEndDate) setDailyEndDate(value);
        }}
        onDailyEndDateChange={(value) => {
          setDailyEndDate(value);
          if (value < dailyStartDate) setDailyStartDate(value);
        }}
        onTodayClick={() => applyQuickRange(todayRange.start, todayRange.end)}
        quickRanges={quickRanges}
        onQuickRangeClick={applyQuickRange}
      />

      {loading ? <SkeletonDashboard /> : null}
      {!loading && error ? (
        <ScreenState
          variant="error"
          title={translateUi('Falha ao carregar dashboard')}
          description={error}
          action={{ label: translateUi('Tentar novamente'), onClick: () => void reload() }}
        />
      ) : null}
      {!loading && !error && !dashboard ? (
        <ScreenState
          variant="empty"
          title={translateUi('Nenhum dado encontrado')}
          description="Não foi possível montar o dashboard para o período selecionado."
        />
      ) : null}
      {!loading && !error && dashboard ? (
        viewMode === 'daily' ? (
          <DashboardPersonalDailySection
            dashboard={dashboard}
            clientId={clientId}
            clients={clients}
            activityTags={activityTags}
            aiStatus={aiStatus}
            onQuickLog={handleQuickLog}
            loadActivitySuggestions={loadActivitySuggestions}
          />
        ) : (
          <DashboardPersonalOverviewSection
            dashboard={dashboard}
            layoutMode={layoutMode}
            clientId={clientId}
            clients={clients}
            activityTags={activityTags}
            aiStatus={aiStatus}
            clientNameById={clientNameById}
            lockByClient={lockByClient}
            selectedLockStatus={selectedLockStatus}
            recentWeekPoints={recentWeekPoints}
            recentWeekFooter={`Semana atual: ${formatMinutes(weekComparison.currentTotal)} · Semana anterior: ${formatMinutes(weekComparison.previousTotal)} · Variacao: ${weekComparison.delta >= 0 ? '+' : ''}${formatMinutes(Math.abs(weekComparison.delta))}`}
            metrics={overviewMetrics}
            insights={overviewInsights}
            onQuickLog={handleQuickLog}
            loadActivitySuggestions={loadActivitySuggestions}
          />
        )
      ) : null}
    </AppShell>
  );
};

export default DashboardPersonalPage;
