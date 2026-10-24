import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type {
  AssignmentWindow,
  HistoricalAccessRepository,
} from '../../domain/repositories/historical-access.repository.js';

const toDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const buildHistoryRangeClause = (startDate?: Date, endDate?: Date) => {
  const start = startDate ? toDateOnly(startDate) : '1900-01-01';
  const end = endDate ? toDateOnly(endDate) : '9999-12-31';

  return Prisma.sql`h.startDate <= ${end} AND (h.endDate IS NULL OR h.endDate >= ${start})`;
};

const clientIdFilter = (candidateClientIds?: number[]) =>
  candidateClientIds && candidateClientIds.length > 0
    ? { clientId: { in: candidateClientIds } }
    : {};

export class PrismaHistoricalAccessRepository implements HistoricalAccessRepository {
  async findCurrentManagedConsultantIds(managerId: number): Promise<number[]> {
    const consultants = await prisma.user.findMany({
      where: { managerId, roleId: 3, isActive: true },
      select: { id: true },
    });
    return consultants.map((item) => item.id);
  }

  async findHistoricalManagedConsultantIds(
    managerId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<number[]> {
    const rows = await prisma.$queryRaw<Array<{ consultantId: number }>>(Prisma.sql`
      SELECT DISTINCT h.consultantId
      FROM manager_assignment_history h
      WHERE h.managerId = ${managerId}
        AND ${buildHistoryRangeClause(startDate, endDate)}
    `);
    return rows.map((item) => Number(item.consultantId));
  }

  async findCurrentManagerLink(
    managerId: number,
    consultantId: number
  ): Promise<{ id: number } | null> {
    return prisma.user.findFirst({
      where: { id: consultantId, managerId },
      select: { id: true },
    });
  }

  async findHistoricalAssignmentWindows(
    managerId: number,
    consultantId: number,
    date: Date
  ): Promise<AssignmentWindow[]> {
    return prisma.$queryRaw<AssignmentWindow[]>(Prisma.sql`
      SELECT h.startDate, h.endDate
      FROM manager_assignment_history h
      WHERE h.managerId = ${managerId}
        AND h.consultantId = ${consultantId}
        AND h.startDate <= ${toDateOnly(date)}
        AND (h.endDate IS NULL OR h.endDate >= ${toDateOnly(date)})
      LIMIT 50
    `);
  }

  async findOpenAssignment(
    managerId: number,
    consultantId: number
  ): Promise<{ id: number; startDate: Date } | null> {
    return prisma.managerAssignmentHistory.findFirst({
      where: { managerId, consultantId, endDate: null },
      orderBy: { startDate: 'desc' },
      select: { id: true, startDate: true },
    });
  }

  async closeAssignment(id: number, endDate: Date): Promise<void> {
    await prisma.managerAssignmentHistory.update({
      where: { id },
      data: { endDate },
    });
  }

  async createAssignment(managerId: number, consultantId: number, startDate: Date): Promise<void> {
    await prisma.managerAssignmentHistory.create({
      data: { managerId, consultantId, startDate, endDate: null },
    });
  }

  async findLinkedClientIds(userId: number, candidateClientIds?: number[]): Promise<number[]> {
    const linked = await prisma.userClient.findMany({
      where: { userId, ...clientIdFilter(candidateClientIds) },
      select: { clientId: true },
    });
    return linked.map((item) => item.clientId);
  }

  async findLinkedClientIdsForUsers(
    userIds: number[],
    candidateClientIds?: number[]
  ): Promise<number[]> {
    const linked = await prisma.userClient.findMany({
      where: {
        userId: { in: userIds.length > 0 ? userIds : [-1] },
        ...clientIdFilter(candidateClientIds),
      },
      select: { clientId: true },
    });
    return linked.map((item) => item.clientId);
  }

  async findClientIdsWithTimeEntries(
    userId: number,
    candidateClientIds?: number[]
  ): Promise<number[]> {
    const grouped = await prisma.timeEntry.groupBy({
      by: ['clientId'],
      where: { userId, ...clientIdFilter(candidateClientIds) },
    });
    return grouped.map((item) => item.clientId);
  }

  async findClientIdsWithTimeEntriesForUsers(
    userIds: number[],
    candidateClientIds?: number[]
  ): Promise<number[]> {
    const grouped = await prisma.timeEntry.groupBy({
      by: ['clientId'],
      where: {
        userId: { in: userIds.length > 0 ? userIds : [-1] },
        ...clientIdFilter(candidateClientIds),
      },
    });
    return grouped.map((item) => item.clientId);
  }

  async findClientLink(userId: number, clientId: number): Promise<{ userId: number } | null> {
    return prisma.userClient.findUnique({
      where: { userId_clientId: { userId, clientId } },
      select: { userId: true },
    });
  }

  async findAnyTimeEntry(userId: number, clientId: number): Promise<{ id: number } | null> {
    return prisma.timeEntry.findFirst({
      where: { userId, clientId },
      select: { id: true },
    });
  }
}

export const historicalAccessRepository = new PrismaHistoricalAccessRepository();
