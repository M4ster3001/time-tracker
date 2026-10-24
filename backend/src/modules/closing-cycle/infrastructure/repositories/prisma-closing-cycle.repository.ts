import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type {
  AllocationHistoryRow,
  AllocationSnapshotRow,
  ClosingCycleClient,
  ClosingCycleRepository,
  ClosingCycleTimeEntry,
  ClosingCycleTimeEntryForUser,
  UserClientLink,
} from '../../domain/repositories/closing-cycle.repository.js';

export class PrismaClosingCycleRepository implements ClosingCycleRepository {
  async findClientIdsLinkedToUser(userId: number): Promise<number[]> {
    const links = await prisma.userClient.findMany({
      where: { userId },
      select: { clientId: true },
    });
    return (links ?? []).map((item) => item.clientId);
  }

  async findClientIdsLinkedToUsers(userIds: number[]): Promise<UserClientLink[]> {
    if (userIds.length === 0) return [];
    const links = await prisma.userClient.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, clientId: true },
    });
    return links ?? [];
  }

  async findClientIdsWithTimeEntriesInRange(
    userId: number,
    start: Date,
    end: Date
  ): Promise<number[]> {
    const entries = await prisma.timeEntry.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { clientId: true },
      distinct: ['clientId'],
    });
    return (entries ?? []).map((item) => item.clientId);
  }

  async findClientIdsWithTimeEntriesInRangeForUsers(
    userIds: number[],
    start: Date,
    end: Date
  ): Promise<UserClientLink[]> {
    if (userIds.length === 0) return [];
    const entries = await prisma.timeEntry.findMany({
      where: { userId: { in: userIds }, date: { gte: start, lte: end } },
      select: { userId: true, clientId: true },
      distinct: ['userId', 'clientId'],
    });
    return entries ?? [];
  }

  async findClientsByIds(clientIds: number[]): Promise<ClosingCycleClient[]> {
    if (clientIds.length === 0) return [];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, lockDay: true },
      orderBy: { name: 'asc' },
    });
    return clients ?? [];
  }

  async findTimeEntriesInRange(
    userId: number,
    clientIds: number[],
    start: Date,
    end: Date
  ): Promise<ClosingCycleTimeEntry[]> {
    if (clientIds.length === 0) return [];
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId,
        clientId: { in: clientIds },
        date: { gte: start, lte: end },
      },
      select: { clientId: true, durationMinutes: true, date: true },
    });
    return entries ?? [];
  }

  async findTimeEntriesInRangeForUsers(
    userIds: number[],
    clientIds: number[],
    start: Date,
    end: Date
  ): Promise<ClosingCycleTimeEntryForUser[]> {
    if (userIds.length === 0 || clientIds.length === 0) return [];
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: { in: userIds },
        clientId: { in: clientIds },
        date: { gte: start, lte: end },
      },
      select: { userId: true, clientId: true, durationMinutes: true, date: true },
    });
    return entries ?? [];
  }

  async findAllocationHistoryInRange(params: {
    userId: number;
    clientIds: number[];
    minStart: Date;
    maxEnd: Date;
  }): Promise<Array<Partial<AllocationHistoryRow>>> {
    if (params.clientIds.length === 0) return [];

    const rows = await prisma.$queryRaw<AllocationHistoryRow[]>(Prisma.sql`
      SELECT
        userId,
        clientId,
        allocationType,
        hoursPerDay,
        hoursPerMonth,
        effectiveFrom,
        effectiveTo
      FROM client_allocation_history
      WHERE userId = ${params.userId}
        AND clientId IN (${Prisma.join(params.clientIds)})
        AND effectiveFrom <= ${params.maxEnd}
        AND (effectiveTo IS NULL OR effectiveTo >= ${params.minStart})
      ORDER BY clientId ASC, effectiveFrom ASC
    `);

    return rows ?? [];
  }

  async findAllocationHistoryInRangeForUsers(params: {
    userIds: number[];
    clientIds: number[];
    minStart: Date;
    maxEnd: Date;
  }): Promise<Array<Partial<AllocationHistoryRow>>> {
    if (params.userIds.length === 0 || params.clientIds.length === 0) return [];

    const rows = await prisma.$queryRaw<AllocationHistoryRow[]>(Prisma.sql`
      SELECT
        userId,
        clientId,
        allocationType,
        hoursPerDay,
        hoursPerMonth,
        effectiveFrom,
        effectiveTo
      FROM client_allocation_history
      WHERE userId IN (${Prisma.join(params.userIds)})
        AND clientId IN (${Prisma.join(params.clientIds)})
        AND effectiveFrom <= ${params.maxEnd}
        AND (effectiveTo IS NULL OR effectiveTo >= ${params.minStart})
      ORDER BY userId ASC, clientId ASC, effectiveFrom ASC
    `);

    return rows ?? [];
  }

  async findCurrentAllocationSnapshot(
    userId: number,
    clientIds: number[]
  ): Promise<AllocationSnapshotRow[]> {
    if (clientIds.length === 0) return [];

    const rows = await prisma.$queryRaw<AllocationSnapshotRow[]>(Prisma.sql`
      SELECT userId, clientId, allocationType, hoursPerDay, hoursPerMonth
      FROM client_allocations
      WHERE userId = ${userId}
        AND clientId IN (${Prisma.join(clientIds)})
    `);

    return rows ?? [];
  }

  async findCurrentAllocationSnapshotsForUsers(
    userIds: number[],
    clientIds: number[]
  ): Promise<AllocationSnapshotRow[]> {
    if (userIds.length === 0 || clientIds.length === 0) return [];

    const rows = await prisma.$queryRaw<AllocationSnapshotRow[]>(Prisma.sql`
      SELECT userId, clientId, allocationType, hoursPerDay, hoursPerMonth
      FROM client_allocations
      WHERE userId IN (${Prisma.join(userIds)})
        AND clientId IN (${Prisma.join(clientIds)})
    `);

    return rows ?? [];
  }
}

export const closingCycleRepository = new PrismaClosingCycleRepository();
