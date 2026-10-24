export type ReportAllocationType = 'DAILY' | 'MONTHLY';

export interface ReportUserSnapshot {
  id: number;
  roleId: number;
  name: string;
  email: string;
  managerId: number | null;
  isActive: boolean;
  deletedAt: Date | null;
  manager: { id: number; name: string } | null;
}

export interface ReportClientSnapshot {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  deletedAt: Date | null;
  paysOvertime: boolean;
}

export interface ReportEntryRow {
  userId: number;
  clientId: number;
  date: Date;
  durationMinutes: number;
  user: ReportUserSnapshot;
  client: ReportClientSnapshot;
}

export interface ReportAllocationRow {
  userId: number;
  clientId: number;
  allocationType: ReportAllocationType;
  hoursPerDay: number | null;
  hoursPerMonth: number | null;
  hourlyRate: number | null;
  user: ReportUserSnapshot;
  client: ReportClientSnapshot;
}

export interface ConsultantPerformanceData {
  baseConsultants: ReportUserSnapshot[];
  entries: ReportEntryRow[];
  allocations: ReportAllocationRow[];
}

export interface ClientCapacityData {
  baseClients: ReportClientSnapshot[];
  entries: ReportEntryRow[];
  allocations: ReportAllocationRow[];
}

export interface ExportEntryRow {
  userId: number;
  roleId: number;
  clientId: number;
  date: Date;
  userName: string;
  consultantName: string;
  clientName: string;
  /** Optional project under the client; null → "(Sem projeto)" in timesheet export. */
  projectName: string | null;
  activityDescription: string;
  durationMinutes: number;
}

export interface ReportRepository {
  getConsultantPerformanceData(filters: {
    clientId?: number;
    startDate: Date;
    endDate: Date;
  }): Promise<ConsultantPerformanceData>;
  getClientCapacityData(filters: {
    clientId?: number;
    startDate: Date;
    endDate: Date;
    includeInactive?: boolean;
  }): Promise<ClientCapacityData>;
  getExportData(filters: {
    month: number;
    year: number;
    consultantId?: number;
    clientId?: number;
    userIds?: number[];
  }): Promise<ExportEntryRow[]>;
}
