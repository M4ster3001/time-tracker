import type { IClient } from '../client.types.js';
import type { IUser } from '../../../users/domain/user.types.js';

export interface ClientRepository {
  countClients(where: Record<string, unknown>): Promise<number>;
  listClients(params: {
    where: Record<string, unknown>;
    skip: number;
    take: number;
  }): Promise<IClient[]>;
  findClientByCode(code: string): Promise<IClient | null>;
  createClient(data: {
    name: string;
    code: string;
    lockDay: number | null;
    paysOvertime: boolean;
    isActive: boolean;
    requireProjectOnEntries?: boolean;
  }): Promise<IClient>;
  findClientById(id: number): Promise<IClient | null>;
  updateClient(
    id: number,
    data: {
      name?: string;
      code?: string;
      lockDay?: number | null;
      paysOvertime?: boolean;
      requireProjectOnEntries?: boolean;
      isActive?: boolean;
    }
  ): Promise<IClient>;
  removeAllUserLinks(clientId: number): Promise<void>;
  softDeleteClient(id: number, deletedBy?: number): Promise<void>;
  restoreClient(id: number, restoredBy?: number): Promise<IClient>;
  permanentlyDeleteClient(id: number): Promise<void>;
  listClientUsers(clientId: number): Promise<IUser[]>;
  createAuditLog(data: {
    userId: number | null;
    endpoint: string;
    action: string;
    status: string;
    details: string;
  }): Promise<void>;
}
