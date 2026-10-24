import type { Prisma } from '@prisma/client';
import type { ITemporaryUnlock, ITemporaryUnlockEdit } from '../temporary-unlock.types.js';

export type TemporaryUnlockListItem = ITemporaryUnlock & {
  userName: string;
  clientName: string;
  adminName: string;
  editCount: number;
};

export type TemporaryUnlockDetails = ITemporaryUnlock & {
  userName: string;
  clientName: string;
  adminName: string;
  edits: ITemporaryUnlockEdit[];
};

export interface TemporaryUnlockAuditLogInput {
  userId: number;
  endpoint: string;
  action: string;
  status: string;
  details?: string;
}

export interface TemporaryUnlockRepository {
  findUserStatus(userId: number): Promise<{ id: number; isActive: boolean } | null>;
  findClientStatus(clientId: number): Promise<{ id: number; isActive: boolean } | null>;
  hasUserClientLink(userId: number, clientId: number): Promise<boolean>;
  findActiveUnlockForPeriod(params: {
    userId: number;
    clientId: number;
    periodYear: number;
    periodMonth: number;
    now: Date;
  }): Promise<ITemporaryUnlock | null>;
  createTemporaryUnlock(data: {
    userId: number;
    clientId: number;
    grantedBy: number;
    periodYear: number;
    periodMonth: number;
    reason: string;
    expiresAt: Date;
  }): Promise<ITemporaryUnlock>;
  findTemporaryUnlockById(id: number): Promise<ITemporaryUnlock | null>;
  updateTemporaryUnlock(id: number, data: { revokedAt: Date }): Promise<ITemporaryUnlock>;
  createAuditLog(data: TemporaryUnlockAuditLogInput): Promise<void>;
  createTemporaryUnlockEdit(data: {
    temporaryUnlockId: number;
    timeEntryId: number | null;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    previousData?: Prisma.InputJsonValue;
    newData?: Prisma.InputJsonValue;
  }): Promise<void>;
  listTemporaryUnlocks(params: {
    userId?: number;
    clientId?: number;
    activeOnly?: boolean;
    page: number;
    limit: number;
    now: Date;
  }): Promise<{ items: TemporaryUnlockListItem[]; total: number }>;
  findTemporaryUnlockDetails(id: number): Promise<TemporaryUnlockDetails | null>;
  findActiveTemporaryUnlockByEntryDate(params: {
    userId: number;
    clientId: number;
    periodYear: number;
    periodMonth: number;
    now: Date;
  }): Promise<{ unlockId: number } | null>;
}
