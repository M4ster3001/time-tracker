import type { ReportAllocationType } from '../domain/repositories/report.repository.js';

export type NullablePercent = number | null;

export type EntryWithRefs = {
  userId: number;
  clientId: number;
  date: Date;
  durationMinutes: number;
  user: {
    id: number;
    roleId: number;
    name: string;
    email: string;
    managerId: number | null;
    isActive: boolean;
    deletedAt: Date | null;
    manager: { id: number; name: string } | null;
  };
  client: {
    id: number;
    name: string;
    code: string;
    isActive: boolean;
    deletedAt: Date | null;
  };
};

export type AllocationWithRefs = {
  userId: number;
  clientId: number;
  allocationType: ReportAllocationType;
  hoursPerDay: number | null;
  hoursPerMonth: number | null;
  user: {
    id: number;
    roleId: number;
    name: string;
    email?: string;
    managerId?: number | null;
    isActive?: boolean;
    deletedAt: Date | null;
    manager?: { id: number; name: string } | null;
  };
  client: {
    id: number;
    name: string;
    code: string;
    isActive: boolean;
    deletedAt: Date | null;
  };
};
