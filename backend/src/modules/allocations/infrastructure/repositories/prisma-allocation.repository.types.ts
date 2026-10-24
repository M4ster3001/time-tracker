import type { IClientAllocation } from '../../domain/allocation.types.js';

export type AllocationHistoryRow = IClientAllocation & {
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdBy: number | null;
};
