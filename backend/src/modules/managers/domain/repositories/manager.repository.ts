import type { IClient } from '../../../clients/domain/client.types.js';
import type { IUser } from '../../../users/domain/user.types.js';

export type DateRange = { gte: Date; lte: Date };

export interface ManagerRepository {
  clientIdsWithTimeEntries(params: {
    userIds: number[];
    clientId?: number;
    range: DateRange;
  }): Promise<number[]>;

  userIdsWithTimeEntries(params: {
    userIds: number[];
    clientId?: number;
    range: DateRange;
  }): Promise<number[]>;

  findActiveClientsByIds(clientIds: number[]): Promise<IClient[]>;

  findActiveUsersByIds(userIds: number[]): Promise<IUser[]>;

  findDirectAndManagedClients(managerId: number): Promise<IClient[]>;

  findConsultantsByManager(managerId: number): Promise<IUser[]>;

  findConsultantsByManagerAndClient(managerId: number, clientId: number): Promise<IUser[]>;

  findDirectUserClientLink(
    managerId: number,
    clientId: number
  ): Promise<{ userId: number } | null>;

  updateClientLockDay(clientId: number, lockDay: number | null): Promise<IClient>;

  createAuditLog(data: {
    userId: number;
    endpoint: string;
    action: string;
    status: string;
    details: string;
  }): Promise<void>;
}
