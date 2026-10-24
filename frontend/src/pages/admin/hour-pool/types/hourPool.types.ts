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
  billableHours: number;
  hourlyRate: number | null;
  billableAmount: number | null;
}

export interface HourPoolOption {
  id: number;
  name: string;
}
