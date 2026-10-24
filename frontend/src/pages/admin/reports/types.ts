export interface ConsultantPerformance {
  userId: number;
  userName: string;
  userEmail: string;
  managerId: number | null;
  managerName: string | null;
  period: { start: string; end: string };
  allocatedHours: number;
  workedHours: number;
  utilizationPercent: number | null;
  clientBreakdown: {
    clientId: number;
    clientName: string;
    clientCode: string;
    allocatedHours: number;
    workedHours: number;
    utilizationPercent: number | null;
  }[];
  trend: {
    period: string;
    allocatedHours: number;
    workedHours: number;
    utilizationPercent: number | null;
  }[];
}

export interface ClientCapacity {
  clientId: number;
  clientName: string;
  clientCode: string;
  period: { start: string; end: string };
  totalAllocatedHours: number;
  totalWorkedHours: number;
  remainingHours: number;
  utilizationPercent: number | null;
  consultantBreakdown: {
    userId: number;
    userName: string;
    allocatedHours: number;
    workedHours: number;
    utilizationPercent: number | null;
  }[];
}

export type ReportType = 'consultant-performance' | 'client-capacity';
