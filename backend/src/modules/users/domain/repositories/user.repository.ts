import type { IClient } from '../../../clients/domain/client.types.js';
import type { IUser, IUserWithRole } from '../user.types.js';

export interface UserRepository {
  isManagerOfUser(managerId: number, userId: number): Promise<boolean>;
  listCurrentClientIds(userId: number): Promise<number[]>;
  listClientsByIds(clientIds: number[]): Promise<IClient[]>;
  listLinkedClients(userId: number): Promise<IClient[]>;
  listHistoricalClientIds(userId: number, range?: { gte: Date; lte: Date }): Promise<number[]>;
  countUsers(where: Record<string, unknown>): Promise<number>;
  listUsers(params: {
    where: Record<string, unknown>;
    skip: number;
    take: number;
  }): Promise<IUserWithRole[]>;
  findUserByEmail(email: string): Promise<IUser | null>;
  createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    roleId: number;
    managerId: number | null;
  }): Promise<IUserWithRole>;
  findUserById(id: number): Promise<IUserWithRole | null>;
  findUserForUpdate(
    id: number
  ): Promise<{ id: number; roleId: number; managerId: number | null } | null>;
  updateUser(
    id: number,
    data: {
      name?: string;
      email?: string;
      roleId?: number;
      managerId?: number | null;
      isActive?: boolean;
    }
  ): Promise<IUserWithRole>;
  softDeleteUser(id: number, deletedBy?: number): Promise<void>;
  restoreUser(id: number, restoredBy?: number): Promise<IUserWithRole>;
  permanentlyDeleteUser(id: number): Promise<void>;
  findUserPasswordData(
    id: number
  ): Promise<{ id: number; passwordHash: string; deletedAt?: Date | null } | null>;
  updatePasswordHash(id: number, passwordHash: string): Promise<void>;
  createAuditLog(data: {
    userId: number | null;
    endpoint: string;
    action: string;
    status: string;
    details: string;
  }): Promise<void>;
  findClientActive(clientId: number): Promise<boolean>;
  findUserActive(userId: number): Promise<boolean>;
  findUserClientLink(userId: number, clientId: number): Promise<boolean>;
  createUserClientLink(userId: number, clientId: number): Promise<void>;
  deleteUserClientLink(userId: number, clientId: number): Promise<void>;
  listUserClientIds(userId: number): Promise<number[]>;
}
