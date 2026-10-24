export type AllocationType = 'DAILY' | 'MONTHLY';

export interface IClientAllocation {
  id: number;
  userId: number;
  clientId: number;
  allocationType: AllocationType;
  hoursPerDay: number | null;
  hoursPerMonth: number | null;
  hourlyRate: number | null;
  createdAt: Date;
  updatedAt: Date;
}
