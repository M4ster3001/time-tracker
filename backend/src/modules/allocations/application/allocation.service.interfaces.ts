import type { AllocationType, IClientAllocation } from '../domain/allocation.types.js';
import type { ConsultantAllocationListItem } from '../domain/repositories/allocation.repository.types.js';

export interface UpsertConsultantAllocationInput {
  consultantId: number;
  clientId: number;
  allocationType: AllocationType;
  hoursPerDay?: number | null;
  hoursPerMonth?: number | null;
  hourlyRate?: number | null;
  effectiveFrom?: Date;
  createdBy?: number | null;
}

export interface AllocationTargetInput {
  allocationType: AllocationType;
  hoursPerDay: number | null;
  hoursPerMonth: number | null;
}

export interface AllocationService {
  listConsultantAllocations(consultantId: number): Promise<ConsultantAllocationListItem[]>;
  upsertConsultantAllocation(params: UpsertConsultantAllocationInput): Promise<IClientAllocation>;
  deleteConsultantAllocation(consultantId: number, clientId: number): Promise<void>;
}
