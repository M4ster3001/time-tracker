import type { AllocationType, IClientAllocation } from '../allocation.types.js';

export type ConsultantAllocationListItem = {
  clientId: number;
  clientName: string;
  allocation: IClientAllocation | null;
};

export type UpsertConsultantAllocationParams = {
  consultantId: number;
  clientId: number;
  allocationType: AllocationType;
  hoursPerDay?: number | null;
  hoursPerMonth?: number | null;
  hourlyRate?: number | null;
  effectiveFrom: Date;
  createdBy?: number | null;
};

export type AllocationAuditLogInput = {
  userId: number | null;
  endpoint: string;
  action: string;
  status: string;
  details: string;
};
