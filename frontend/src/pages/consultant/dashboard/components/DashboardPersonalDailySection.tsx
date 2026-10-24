import React from 'react';
import DailyStackedBars from '../../../../components/DailyStackedBars';
import QuickLogWidget from '../../../../components/QuickLogWidget';
import type {
  ActivitySuggestion,
  ClientOption,
  DashboardResponse,
  QuickLogPayload,
} from '../types/dashboardPersonal.types';

interface DashboardPersonalDailySectionProps {
  dashboard: DashboardResponse;
  clientId: number;
  clients: ClientOption[];
  activityTags: ActivitySuggestion[];
  aiStatus?: { enabled: boolean; provider?: string | null } | null;
  onQuickLog: (payload: QuickLogPayload) => Promise<void>;
  loadActivitySuggestions: (clientId?: number) => Promise<ActivitySuggestion[]>;
}

const DashboardPersonalDailySection: React.FC<DashboardPersonalDailySectionProps> = ({
  dashboard,
  clientId,
  clients,
  activityTags,
  aiStatus,
  onQuickLog,
  loadActivitySuggestions,
}) => {
  return (
    <section className="animate-fade-up space-y-6">
      <DailyStackedBars
        data={dashboard.daily}
        selectedClientId={clientId || undefined}
        defaultScale="client"
        storageKey="dailyScale:consultant"
      />

      <QuickLogWidget
        clients={clients}
        activities={activityTags}
        aiStatus={aiStatus ?? undefined}
        onSave={onQuickLog}
        loadSuggestions={loadActivitySuggestions}
      />
    </section>
  );
};

export default DashboardPersonalDailySection;
