import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type { IClient } from '../../../clients/domain/client.types.js';
import type { IUser } from '../../../users/domain/user.types.js';
import type {
  DateRange,
  ManagerRepository,
} from '../../domain/repositories/manager.repository.js';

const CLIENT_SELECT = {
  id: true,
  name: true,
  code: true,
  lockDay: true,
  paysOvertime: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  roleId: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaManagerRepository implements ManagerRepository {
  async clientIdsWithTimeEntries(params: {
    userIds: number[];
    clientId?: number;
    range: DateRange;
  }): Promise<number[]> {
    const grouped = await prisma.timeEntry.groupBy({
      by: ['clientId'],
      where: {
        date: params.range,
        ...(params.clientId ? { clientId: params.clientId } : {}),
        userId: { in: params.userIds.length > 0 ? params.userIds : [-1] },
      },
    });
    return grouped.map((item) => item.clientId);
  }

  async userIdsWithTimeEntries(params: {
    userIds: number[];
    clientId?: number;
    range: DateRange;
  }): Promise<number[]> {
    const grouped = await prisma.timeEntry.groupBy({
      by: ['userId'],
      where: {
        date: params.range,
        ...(params.clientId ? { clientId: params.clientId } : {}),
        userId: { in: params.userIds.length > 0 ? params.userIds : [-1] },
      },
    });
    return grouped.map((item) => item.userId);
  }

  async findActiveClientsByIds(clientIds: number[]): Promise<IClient[]> {
    if (clientIds.length === 0) return [];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds }, isActive: true },
      select: CLIENT_SELECT,
      orderBy: { name: 'asc' },
    });
    return clients as IClient[];
  }

  async findActiveUsersByIds(userIds: number[]): Promise<IUser[]> {
    if (userIds.length === 0) return [];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });
    return users as IUser[];
  }

  async findDirectAndManagedClients(managerId: number): Promise<IClient[]> {
    const [directClients, managedClients] = await Promise.all([
      prisma.userClient.findMany({
        where: { userId: managerId, client: { isActive: true } },
        select: { client: { select: CLIENT_SELECT } },
      }),
      prisma.userClient.findMany({
        where: { user: { managerId }, client: { isActive: true } },
        select: { client: { select: CLIENT_SELECT } },
      }),
    ]);

    const map = new Map<number, IClient>();
    [...directClients, ...managedClients].forEach((link) => {
      map.set(link.client.id, link.client as IClient);
    });
    return Array.from(map.values());
  }

  async findConsultantsByManager(managerId: number): Promise<IUser[]> {
    const users = await prisma.user.findMany({
      where: { managerId, isActive: true },
      select: USER_SELECT,
    });
    return users as IUser[];
  }

  async findConsultantsByManagerAndClient(managerId: number, clientId: number): Promise<IUser[]> {
    const links = await prisma.userClient.findMany({
      where: { clientId, user: { managerId, isActive: true } },
      select: { user: { select: USER_SELECT } },
    });

    const map = new Map<number, IUser>();
    links.forEach((link) => {
      map.set(link.user.id, link.user as IUser);
    });
    return Array.from(map.values());
  }

  async findDirectUserClientLink(
    managerId: number,
    clientId: number
  ): Promise<{ userId: number } | null> {
    return prisma.userClient.findUnique({
      where: { userId_clientId: { userId: managerId, clientId } },
      select: { userId: true },
    });
  }

  async updateClientLockDay(clientId: number, lockDay: number | null): Promise<IClient> {
    const updated = await prisma.client.update({
      where: { id: clientId },
      data: { lockDay },
    });
    return updated as IClient;
  }

  async createAuditLog(data: {
    userId: number;
    endpoint: string;
    action: string;
    status: string;
    details: string;
  }): Promise<void> {
    await prisma.auditLog.create({ data });
  }
}

export const managerRepository = new PrismaManagerRepository();
