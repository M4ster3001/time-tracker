export interface AdminDashboardResponse {
  totalConsultants: number;
  totalHours: number;
  targetHours: number;
  progressPercent: number;
  overtimeMinutes: number;
  overtimeByClient: Array<{
    clientId: number;
    clientName: string;
    paysOvertime: boolean;
    overtimeMinutes: number;
  }>;
  overtimeByConsultant: Array<{ userId: number; userName: string; overtimeMinutes: number }>;
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
  topClients: Array<{
    clientId: number;
    clientName: string;
    hours: number;
    paysOvertime: boolean;
  }>;
  topConsultants: Array<{ userId: number; userName: string; hours: number }>;
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
}
