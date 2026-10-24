import type { IClientAllocation } from '../allocation.types.js';
import type {
  AllocationAuditLogInput,
  ConsultantAllocationListItem,
  UpsertConsultantAllocationParams,
} from './allocation.repository.types.js';

export interface AllocationRepository {
  hasUserClientLink(userId: number, clientId: number): Promise<boolean>;
  hasManagerAccessToConsultant(managerId: number, consultantId: number): Promise<boolean>;
  listConsultantAllocations(consultantId: number): Promise<ConsultantAllocationListItem[]>;
  upsertConsultantAllocation(params: UpsertConsultantAllocationParams): Promise<IClientAllocation>;
  deleteConsultantAllocation(consultantId: number, clientId: number): Promise<void>;
  getAllocationAtDate(
    userId: number,
    clientId: number,
    date: Date
  ): Promise<IClientAllocation | null>;
  getAllocationsInRange(
    userId: number,
    clientId: number,
    startDate: Date,
    endDate: Date
  ): Promise<IClientAllocation[]>;
  createAuditLog(data: AllocationAuditLogInput): Promise<void>;
}
