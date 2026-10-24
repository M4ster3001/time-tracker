import type { AllocationType } from '../domain/allocation.types.js';

export interface AllocationRouteParams {
  id?: string;
  clientId?: string;
}

export interface UpsertAllocationRequestBody {
  allocationType: AllocationType;
  hoursPerDay?: number | null | string;
  hoursPerMonth?: number | null | string;
}
