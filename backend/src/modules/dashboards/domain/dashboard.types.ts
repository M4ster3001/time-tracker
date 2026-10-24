import type { ITimeEntry } from '../../time-tracking/domain/time-entry.types.js';
import type { CycleSummaryResult } from '../../closing-cycle/application/closing-cycle.service.js';

export interface DailyEntryItem {
  id: number;
  userId: number;
  userName: string;
  activityDescription: string;
  durationMinutes: number;
}

export interface DailyClientBucket {
  clientId: number;
  clientName: string;
  minutes: number;
  entries: DailyEntryItem[];
}

export interface DailyBucket {
  date: string;
  totalMinutes: number;
  clients: DailyClientBucket[];
}

export interface ConsultantDashboardResult {
  totalHours: number;
  totalMinutes: number;
  targetHours: number;
  targetMinutes: number;
  progressPercent: number;
  byClient: Array<{
    clientId: number;
    clientName: string;
    paysOvertime: boolean;
    hours: number;
    targetMinutes: number;
  }>;
  daily: DailyBucket[];
  overtimeMinutes: number;
  overtimeByClient: Array<{
    clientId: number;
    clientName: string;
    paysOvertime: boolean;
    targetMinutes: number;
    overtimeMinutes: number;
  }>;
  cycleSummary: CycleSummaryResult;
  entries: ITimeEntry[];
}

export interface ManagerDashboardConsultant {
  id: number;
  name: string;
  totalHours: number;
  totalMinutes: number;
  targetHours: number;
  targetMinutes: number;
  progressPercent: number;
  byClient: Array<{
    clientId: number;
    clientName: string;
    paysOvertime: boolean;
    hours: number;
    targetMinutes: number;
  }>;
  daily: DailyBucket[];
  overtimeMinutes: number;
  overtimeByClient: Array<{
    clientId: number;
    clientName: string;
    paysOvertime: boolean;
    targetMinutes: number;
    overtimeMinutes: number;
  }>;
  cycleSummary: CycleSummaryResult;
}

export interface ManagerDashboardResult {
  consultants: ManagerDashboardConsultant[];
}

export interface AdminDashboardResult {
  totalConsultants: number;
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
    overtimeMinutes: number;
  }>;
  overtimeByConsultant: Array<{ userId: number; userName: string; overtimeMinutes: number }>;
  cycleSummary: {
    consultants: Array<{ userId: number; summary: CycleSummaryResult }>;
    totals: CycleSummaryResult['totals'];
  };
  topClients: Array<{
    clientId: number;
    clientName: string;
    hours: number;
    paysOvertime: boolean;
  }>;
  topConsultants: Array<{ userId: number; userName: string; hours: number }>;
  daily: DailyBucket[];
}
