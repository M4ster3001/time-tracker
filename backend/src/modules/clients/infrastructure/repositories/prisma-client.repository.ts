import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type { IClient } from '../../domain/client.types.js';
import type { IUser } from '../../../users/domain/user.types.js';
import type { ClientRepository } from '../../domain/repositories/client.repository.js';

export class PrismaClientRepository implements ClientRepository {
  countClients(where: Record<string, unknown>): Promise<number> {
    return prisma.client.count({ where });
  }

  async listClients(params: {
    where: Record<string, unknown>;
    skip: number;
    take: number;
  }): Promise<IClient[]> {
    const clients = await prisma.client.findMany({
      where: params.where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
    return clients as IClient[];
  }

  async findClientByCode(code: string): Promise<IClient | null> {
    return (await prisma.client.findUnique({ where: { code } })) as IClient | null;
  }

  async createClient(data: {
    name: string;
    code: string;
    lockDay: number | null;
    paysOvertime: boolean;
    isActive: boolean;
    requireProjectOnEntries?: boolean;
  }): Promise<IClient> {
    return (await prisma.client.create({ data })) as IClient;
  }

  async findClientById(id: number): Promise<IClient | null> {
    return (await prisma.client.findUnique({ where: { id } })) as IClient | null;
  }

  async updateClient(
    id: number,
    data: {
      name?: string;
      code?: string;
      lockDay?: number | null;
      paysOvertime?: boolean;
      requireProjectOnEntries?: boolean;
      isActive?: boolean;
    }
  ): Promise<IClient> {
    return (await prisma.client.update({ where: { id }, data })) as IClient;
  }

  async removeAllUserLinks(clientId: number): Promise<void> {
    await prisma.userClient.deleteMany({ where: { clientId } });
  }

  async softDeleteClient(id: number, deletedBy?: number): Promise<void> {
    await prisma.client.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: deletedBy ?? null,
        isActive: false,
      },
    });
  }

  async restoreClient(id: number): Promise<IClient> {
    return (await prisma.client.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
        isActive: true,
      },
    })) as IClient;
  }

  async permanentlyDeleteClient(id: number): Promise<void> {
    await prisma.client.delete({ where: { id } });
  }

  async listClientUsers(clientId: number): Promise<IUser[]> {
    const links = await prisma.userClient.findMany({
      where: { clientId },
      include: { user: true },
    });
    return links.map((link) => link.user) as IUser[];
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
}

export const clientRepository = new PrismaClientRepository();
