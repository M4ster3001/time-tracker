export interface HourPoolFilters {
  year: number;
  month: number;
  clientId?: number;
  consultantId?: number;
}

/** Uma linha consultor x cliente do ciclo fechado, com valor/hora e total a faturar. */
export interface HourPoolLineItem {
  consultantId: number;
  consultantName: string;
  clientId: number;
  clientName: string;
  clientCode: string;
  paysOvertime: boolean;
  cycleStart: string;
  cycleEnd: string;
  allocatedHours: number;
  workedHours: number;
  overtimeHours: number;
  /** Horas que efetivamente entram no calculo do valor (exclui hora extra se o cliente nao paga). */
  billableHours: number;
  hourlyRate: number | null;
  /** null quando nao ha valor/hora cadastrado para o par consultor+cliente. */
  billableAmount: number | null;
}

export interface ConsultantPerformanceFilters {
  userId?: number;
  managerId?: number;
  clientId?: number;
  startDate: Date;
  endDate: Date;
  includeInactive?: boolean;
}

export interface ConsultantPerformance {
  cycleMode: 'calendar_with_closure_split';
  userId: number;
  userName: string;
  userEmail: string;
  managerId: number | null;
  managerName: string | null;
  period: {
    start: string;
    end: string;
  };
  allocatedHours: number;
  workedHours: number;
  utilizationPercent: number | null;
  closedCycle: {
    workedHours: number;
    allocatedHours: number;
    overtimeHours: number;
  };
  nextCyclePreview: {
    workedHours: number;
    allocatedHours: number;
    overtimeHours: number;
  };
  clientBreakdown: {
    clientId: number;
    clientName: string;
    clientCode: string;
    allocatedHours: number;
    workedHours: number;
    utilizationPercent: number | null;
    closedCycle: {
      startDate: string;
      endDate: string;
      workedHours: number;
      allocatedHours: number;
      overtimeHours: number;
    };
    nextCyclePreview: {
      startDate: string;
      endDate: string;
      workedHours: number;
      allocatedHours: number;
      overtimeHours: number;
    };
  }[];
  trend: {
    period: string;
    allocatedHours: number;
    workedHours: number;
    utilizationPercent: number | null;
  }[];
}

export interface ClientCapacityFilters {
  clientId?: number;
  startDate: Date;
  endDate: Date;
  includeInactive?: boolean;
}

export interface ClientCapacity {
  cycleMode: 'calendar_with_closure_split';
  clientId: number;
  clientName: string;
  clientCode: string;
  period: {
    start: string;
    end: string;
  };
  totalAllocatedHours: number;
  totalWorkedHours: number;
  remainingHours: number;
  utilizationPercent: number | null;
  closedCycle: {
    workedHours: number;
    allocatedHours: number;
    overtimeHours: number;
  };
  nextCyclePreview: {
    workedHours: number;
    allocatedHours: number;
    overtimeHours: number;
  };
  consultantBreakdown: {
    userId: number;
    userName: string;
    allocatedHours: number;
    workedHours: number;
    utilizationPercent: number | null;
    closedCycle: {
      workedHours: number;
      allocatedHours: number;
      overtimeHours: number;
    };
    nextCyclePreview: {
      workedHours: number;
      allocatedHours: number;
      overtimeHours: number;
    };
  }[];
}
