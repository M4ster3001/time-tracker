import type { PrismaClient } from '@prisma/client';
import type { DailySeedRepository } from '../../domain/repositories/daily-seed.repository.js';

export class PrismaDailySeedRepository implements DailySeedRepository {
  constructor(
    private readonly db: Pick<
      PrismaClient,
      'seedRun' | 'user' | 'timeEntry' | 'client' | 'userClient' | 'auditLog'
    >
  ) {}

  findSeedRun(key: string): Promise<{ key: string; lastRunDate: Date } | null> {
    return this.db.seedRun.findUnique({ where: { key } });
  }

  async upsertSeedRun(key: string, lastRunDate: Date): Promise<void> {
    await this.db.seedRun.upsert({
      where: { key },
      create: { key, lastRunDate },
      update: { lastRunDate },
    });
  }

  findActiveConsultants(): Promise<Array<{ id: number }>> {
    return this.db.user.findMany({ where: { roleId: 3, isActive: true }, select: { id: true } });
  }

  findUsersForLogs(): Promise<Array<{ id: number; roleId: number }>> {
    return this.db.user.findMany({
      where: { roleId: { in: [1, 2, 3] } },
      select: { id: true, roleId: true },
    });
  }

  findTimeEntriesInRange(start: Date, end: Date): Promise<Array<{ userId: number; date: Date }>> {
    return this.db.timeEntry.findMany({
      where: { date: { gte: start, lte: end } },
      select: { userId: true, date: true },
    });
  }

  async createTimeEntries(
    entries: Array<{
      userId: number;
      clientId: number;
      date: Date;
      activityDescription: string;
      durationMinutes: number;
    }>
  ): Promise<void> {
    await this.db.timeEntry.createMany({ data: entries });
  }

  findAllClientsByActive(isActive: boolean): Promise<Array<{ id: number }>> {
    return this.db.client.findMany({ where: { isActive }, select: { id: true } });
  }

  async updateClientActive(clientId: number, isActive: boolean): Promise<void> {
    await this.db.client.update({ where: { id: clientId }, data: { isActive } });
  }

  async createClient(): Promise<{ id: number }> {
    const code = `AUTO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;
    return this.db.client.create({
      data: {
        name: `Cliente ${code}`,
        code,
        lockDay: Math.floor(Math.random() * 28) + 1,
        paysOvertime: Math.random() < 0.7,
        isActive: true,
      },
      select: { id: true },
    });
  }

  findConsultantsByActive(isActive: boolean): Promise<Array<{ id: number }>> {
    return this.db.user.findMany({ where: { roleId: 3, isActive }, select: { id: true } });
  }

  async updateUserActive(userId: number, isActive: boolean): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { isActive } });
  }

  findActiveManagers(): Promise<Array<{ id: number }>> {
    return this.db.user.findMany({ where: { roleId: 2, isActive: true }, select: { id: true } });
  }

  createConsultant(data: {
    name: string;
    email: string;
    passwordHash: string;
    managerId: number | null;
  }): Promise<{ id: number }> {
    return this.db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        roleId: 3,
        managerId: data.managerId,
        isActive: true,
      },
      select: { id: true },
    });
  }

  findUserClientLinks(
    userIds: number[],
    clientIds: number[]
  ): Promise<Array<{ userId: number; clientId: number }>> {
    return this.db.userClient.findMany({
      where: { userId: { in: userIds }, clientId: { in: clientIds } },
      select: { userId: true, clientId: true },
    });
  }

  async findUserClientIds(userId: number): Promise<number[]> {
    const rows = await this.db.userClient.findMany({
      where: { userId },
      select: { clientId: true },
    });
    return rows.map((row) => row.clientId);
  }

  async unlinkClient(userId: number, clientId: number): Promise<void> {
    await this.db.userClient.delete({ where: { userId_clientId: { userId, clientId } } });
  }

  async linkClient(userId: number, clientId: number): Promise<void> {
    await this.db.userClient.create({ data: { userId, clientId } });
  }

  async createAuditLogs(
    logs: Array<{
      userId: number | null;
      endpoint: string;
      action: string;
      status: string;
      details: string;
    }>
  ): Promise<void> {
    await this.db.auditLog.createMany({ data: logs });
  }
}
