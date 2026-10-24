export interface DashboardClientCycleMetrics {
  startDate: string;
  endDate: string;
  workedMinutes: number;
  targetMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
}

export interface DashboardResponse {
  totalHours: number;
  totalMinutes: number;
  targetHours: number;
  targetMinutes: number;
  progressPercent: number;
  byClient: Array<{
    clientId: number;
    clientName: string;
    hours: number;
    targetMinutes: number;
  }>;
  daily: Array<{
    date: string;
    totalMinutes: number;
    clients: Array<{
      clientId: number;
      clientName: string;
      minutes: number;
      entries: Array<{
        id: number;
        userId: number;
        userName?: string;
        activityDescription: string;
        durationMinutes: number;
      }>;
    }>;
  }>;
  overtimeMinutes: number;
  overtimeByClient: Array<{
    clientId: number;
    clientName: string;
    targetMinutes: number;
    overtimeMinutes: number;
  }>;
  cycleSummary?: {
    byClient: Array<{
      clientId: number;
      clientName: string;
      closedCycle: DashboardClientCycleMetrics;
      nextCyclePreview: DashboardClientCycleMetrics;
    }>;
    totals: {
      closedCycle: DashboardClientCycleMetrics;
      nextCyclePreview: DashboardClientCycleMetrics;
    };
  };
  entries: Array<{
    id: number;
    clientId: number;
    date: string;
    activityDescription: string;
    durationMinutes: number;
  }>;
}

export interface ClientOption {
  id: number;
  name: string;
  lockDay?: number | null;
}

export interface ActivitySuggestion {
  name: string;
  suggestedDurationMinutes: number;
  usageCount: number;
  lastUsedAt: string | Date | null;
  source: 'client' | 'global' | 'default';
}

export interface LockStatus {
  locked: boolean;
  lockDay: number | null;
}

export interface QuickLogPayload {
  clientId: number;
  activityDescription: string;
  durationMinutes: number;
}

export interface DashboardPersonalInsights {
  cycleItems: Array<{ id: number; title: string; detail: string; badge?: string }>;
  pendingClients: Array<{ id: number; title: string; detail: string; badge?: string }>;
  closingSoonClients: Array<{ id: number; title: string; detail: string; badge?: string }>;
  unusedAllocations: Array<{ id: number; title: string; detail: string; badge?: string }>;
  feedItems: Array<{ id: string; title: string; detail: string; badge?: string }>;
}

export interface DashboardPersonalOverviewMetrics {
  normalMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
  previewOvertimeMinutes: number;
  totalMinutes: number;
  byClient: Array<{
    clientId: number;
    clientName: string;
    workedMinutes: number;
    targetMinutes: number;
    overtimeMinutes: number;
    previewOvertimeMinutes: number;
  }>;
  filteredEntries: DashboardResponse['entries'];
}
