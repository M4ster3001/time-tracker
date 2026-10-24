import type { DailyBucket } from '../../../components/DailyStackedBars';

export interface ManagerDashboardResponse {
  consultants: Array<{
    id: number;
    name: string;
    totalHours: number;
    totalMinutes: number;
    targetHours: number;
    targetMinutes: number;
    progressPercent: number;
    overtimeMinutes: number;
    overtimeByClient: Array<{
      clientId: number;
      clientName: string;
      paysOvertime: boolean;
      targetMinutes: number;
      overtimeMinutes: number;
    }>;
    byClient: Array<{
      clientId: number;
      clientName: string;
      paysOvertime: boolean;
      hours: number;
      targetMinutes: number;
    }>;
    daily: DailyBucket[];
    cycleSummary?: {
      totals: {
        closedCycle: {
          workedMinutes: number;
          targetMinutes: number;
          normalMinutes: number;
          overtimeMinutes: number;
        };
        nextCyclePreview: {
          workedMinutes: number;
          targetMinutes: number;
          normalMinutes: number;
          overtimeMinutes: number;
        };
      };
    };
  }>;
}

export interface ClientOption {
  id: number;
  name: string;
  lockDay?: number | null;
}

export interface ConsultantOption {
  id: number;
  name: string;
}

export type ManagerDashboardViewMode = 'cards' | 'list';
export type ManagerDashboardSectionMode = 'overview' | 'daily';
