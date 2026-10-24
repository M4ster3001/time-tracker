import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import { withAccessSafety } from '../../../access-control/application/access-control.service.js';
import type { IClient } from '../../../clients/domain/client.types.js';
import type { IUser, IUserWithRole } from '../../domain/user.types.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';

export class PrismaUserRepository implements UserRepository {
  async isManagerOfUser(managerId: number, userId: number): Promise<boolean> {
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, managerId },
      select: { id: true },
    });
    return Boolean(targetUser);
  }

  async listCurrentClientIds(userId: number): Promise<number[]> {
    const currentLinks = await prisma.userClient.findMany({
      where: { userId },
      select: { clientId: true },
    });
    return currentLinks.map((item) => item.clientId);
  }

  async listClientsByIds(clientIds: number[]): Promise<IClient[]> {
    if (clientIds.length === 0) return [];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      orderBy: { name: 'asc' },
    });
    return clients as IClient[];
  }

  async listLinkedClients(userId: number): Promise<IClient[]> {
    const userClients = await prisma.userClient.findMany({
      where: { userId },
      include: { client: true },
    });
    return userClients.map((item) => item.client) as IClient[];
  }

  async listHistoricalClientIds(
    userId: number,
    range?: { gte: Date; lte: Date }
  ): Promise<number[]> {
    const grouped = await prisma.timeEntry.groupBy({
      by: ['clientId'],
      where: {
        userId,
        ...(range ? { date: range } : {}),
      },
    });
    return grouped.map((item) => item.clientId);
  }

  countUsers(where: Record<string, unknown>): Promise<number> {
    return prisma.user.count({ where });
  }

  async listUsers(params: {
    where: Record<string, unknown>;
    skip: number;
    take: number;
  }): Promise<IUserWithRole[]> {
    const users = await prisma.user.findMany({
      where: params.where,
      include: { role: true, manager: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
    return users as IUserWithRole[];
  }

  async findUserByEmail(email: string): Promise<IUser | null> {
    return (await prisma.user.findUnique({ where: { email } })) as IUser | null;
  }

  async createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    roleId: number;
    managerId: number | null;
  }): Promise<IUserWithRole> {
    const user = await prisma.user.create({
      data,
      include: { role: true, manager: { select: { id: true, name: true } } },
    });
    return user as IUserWithRole;
  }

  async findUserById(id: number): Promise<IUserWithRole | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true, manager: { select: { id: true, name: true } } },
    });
    return user as IUserWithRole | null;
  }

  async findUserForUpdate(
    id: number
  ): Promise<{ id: number; roleId: number; managerId: number | null } | null> {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, roleId: true, managerId: true },
    });
  }

  async updateUser(
    id: number,
    data: {
      name?: string;
      email?: string;
      roleId?: number;
      managerId?: number | null;
      isActive?: boolean;
    }
  ): Promise<IUserWithRole> {
    const operation = (db: typeof prisma | import('@prisma/client').Prisma.TransactionClient) => db.user.update({
      where: { id },
      data,
      include: { role: true, manager: { select: { id: true, name: true } } },
    });
    const user = data.roleId !== undefined || data.isActive === false ?
      await withAccessSafety(operation) : await operation(prisma);
    return user as IUserWithRole;
  }

  async softDeleteUser(id: number, deletedBy?: number): Promise<void> {
    await withAccessSafety((tx) => tx.user.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: deletedBy ?? null, isActive: false },
    }));
  }

  async restoreUser(id: number): Promise<IUserWithRole> {
    const user = await prisma.user.update({
      where: { id },
      data: { deletedAt: null, deletedBy: null, isActive: true },
      include: { role: true, manager: { select: { id: true, name: true } } },
    });
    return user as IUserWithRole;
  }

  async permanentlyDeleteUser(id: number): Promise<void> {
    await withAccessSafety((tx) => tx.user.delete({ where: { id } }));
  }

  async findUserPasswordData(
    id: number
  ): Promise<{ id: number; passwordHash: string; deletedAt?: Date | null } | null> {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true, deletedAt: true },
    });
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async createAuditLog(data: {
    userId: number | null;
    endpoint: string;
    action: string;
    status: string;
    details: string;
  }): Promise<void> {
    await prisma.auditLog.create({ data });
  }

  async findClientActive(clientId: number): Promise<boolean> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { isActive: true },
    });
    return Boolean(client?.isActive);
  }

  async findUserActive(userId: number): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    return Boolean(user?.isActive);
  }

  async findUserClientLink(userId: number, clientId: number): Promise<boolean> {
    const link = await prisma.userClient.findUnique({
      where: { userId_clientId: { userId, clientId } },
      select: { userId: true },
    });
    return Boolean(link);
  }

  async createUserClientLink(userId: number, clientId: number): Promise<void> {
    await prisma.userClient.create({ data: { userId, clientId } });
  }

  async deleteUserClientLink(userId: number, clientId: number): Promise<void> {
    await prisma.userClient.deleteMany({ where: { userId, clientId } });
  }

  async listUserClientIds(userId: number): Promise<number[]> {
    const links = await prisma.userClient.findMany({
      where: { userId },
      select: { clientId: true },
    });
    return links.map((link) => link.clientId);
  }
}

export const userRepository = new PrismaUserRepository();
