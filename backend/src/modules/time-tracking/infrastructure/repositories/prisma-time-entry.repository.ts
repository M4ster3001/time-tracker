import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type {
  SupervisedAdminEntryQuery,
  SupervisedManagerEntryQuery,
  SupervisedTimeEntryRow,
  TimeEntryClientSnapshot,
  TimeEntryRepository,
} from '../../domain/repositories/time-entry.repository.js';
import type { ITimeEntry, TimeEntrySource } from '../../domain/time-entry.types.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../../app/errors/app-error.js';
import { assertDailyLimit } from '../../domain/services/time-entry-validation.service.js';

/** Hard cap when a caller still hits the unbounded-by-date repository path. */
const TIME_ENTRY_UNBOUNDED_LIST_TAKE = 500;

const assertClosedWindowWritable = async (tx: Prisma.TransactionClient, userId: number,
  clientId: number, date: Date): Promise<void> => {
  await tx.$executeRaw`UPDATE clients SET updatedAt = updatedAt WHERE id = ${clientId}`;
  const closed = await tx.closingPeriod.findFirst({ where: { clientId,
    startDate: { lte: date }, endDate: { gte: date },
    OR: [{ publishedVersion: { gt: 0 } }, { state: 'REVIEW' }] } });
  if (!closed) return;
  const unlock = await tx.temporaryUnlock.findFirst({ where: { userId, clientId,
    periodYear: date.getUTCFullYear(), periodMonth: date.getUTCMonth() + 1,
    revokedAt: null, expiresAt: { gt: new Date() } } });
  if (!unlock) throw new ForbiddenError('CLOSED_PERIOD_REQUIRES_TEMPORARY_UNLOCK');
};

const assertAtomicDailyLimit = async (
  tx: Prisma.TransactionClient,
  userId: number,
  date: Date,
  durationMinutes: number,
  excludeId?: number
): Promise<void> => {
  // All portal/API/sync/bulk writes for a person serialize on this row.
  await tx.$executeRaw`UPDATE users SET updatedAt = updatedAt WHERE id = ${userId}`;
  const aggregate = await tx.timeEntry.aggregate({
    where: { userId, date, deletedAt: null, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    _sum: { durationMinutes: true },
  });
  assertDailyLimit(aggregate._sum.durationMinutes ?? 0, durationMinutes);
};

export class PrismaTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly expectedUpdatedAt?: Date) {}

  async findClientLockDay(clientId: number): Promise<number | null> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { lockDay: true },
    });
    return client?.lockDay ?? null;
  }

  async hasUserClientLink(userId: number, clientId: number): Promise<boolean> {
    const link = await prisma.userClient.findUnique({
      where: {
        userId_clientId: {
          userId,
          clientId,
        },
      },
      select: { userId: true },
    });
    return Boolean(link);
  }

  async findUserClientLinks(userId: number, clientIds: number[]): Promise<number[]> {
    const links = await prisma.userClient.findMany({
      where: {
        userId,
        clientId: { in: clientIds },
      },
      select: { clientId: true },
    });

    return links.map((link) => link.clientId);
  }

  findTimeEntryById(id: number): Promise<ITimeEntry | null> {
    return prisma.timeEntry.findUnique({ where: { id } }) as Promise<ITimeEntry | null>;
  }

  async findManagedEntryAccess(entryUserId: number, managerId: number): Promise<boolean> {
    const managed = await prisma.user.findFirst({
      where: { id: entryUserId, managerId },
      select: { id: true },
    });
    return Boolean(managed);
  }

  createTimeEntry(data: {
    userId: number;
    clientId: number;
    date: Date;
    activityDescription: string;
    durationMinutes: number;
    projectId?: number | null;
    source?: TimeEntrySource;
    uuid?: string;
  }): Promise<ITimeEntry> {
    return prisma.$transaction(async (tx) => {
      await assertClosedWindowWritable(tx, data.userId, data.clientId, data.date);
      await assertAtomicDailyLimit(tx, data.userId, data.date, data.durationMinutes);
      return tx.timeEntry.create({ data: { ...data, source: data.source ?? 'PORTAL' } }) as Promise<ITimeEntry>;
    });
  }

  /** Safety bound for legacy callers; public HTTP list requires year+month instead. */
  findTimeEntriesByUser(userId: number): Promise<ITimeEntry[]> {
    return prisma.timeEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: TIME_ENTRY_UNBOUNDED_LIST_TAKE,
    }) as Promise<ITimeEntry[]>;
  }

  findTimeEntriesByUserAndMonth(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ITimeEntry[]> {
    return prisma.timeEntry.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'desc' },
    }) as Promise<ITimeEntry[]>;
  }

  findTimeEntriesByUserAndClient(userId: number, clientId: number): Promise<ITimeEntry[]> {
    return prisma.timeEntry.findMany({
      where: { userId, clientId },
      orderBy: { date: 'desc' },
      take: TIME_ENTRY_UNBOUNDED_LIST_TAKE,
    }) as Promise<ITimeEntry[]>;
  }

  findTimeEntriesByUserAndClientAndMonth(
    userId: number,
    clientId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ITimeEntry[]> {
    return prisma.timeEntry.findMany({
      where: { userId, clientId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'desc' },
    }) as Promise<ITimeEntry[]>;
  }

  async sumUserDayMinutes(userId: number, date: Date): Promise<number> {
    const result = await prisma.timeEntry.aggregate({
      where: { userId, date },
      _sum: { durationMinutes: true },
    });
    return result._sum.durationMinutes ?? 0;
  }

  async sumUserDayMinutesExcludingEntry(
    userId: number,
    date: Date,
    entryId: number
  ): Promise<number> {
    const result = await prisma.timeEntry.aggregate({
      where: { userId, date, NOT: { id: entryId } },
      _sum: { durationMinutes: true },
    });
    return result._sum.durationMinutes ?? 0;
  }

  async updateTimeEntry(
    id: number,
    data: Partial<{
      clientId: number;
      date: Date;
      activityDescription: string;
      durationMinutes: number;
      projectId: number | null;
    }>,
    dailyLimit?: { userId: number; date: Date; durationMinutes: number;
      previousClientId: number; previousDate: Date; expectedUpdatedAt: Date }
  ): Promise<ITimeEntry> {
    return prisma.$transaction(async (tx) => {
      if (!dailyLimit) throw new ConflictError('WRITE_CONTEXT_REQUIRED');
      const nextClientId = data.clientId ?? dailyLimit.previousClientId;
      for (const clientId of [...new Set([nextClientId, dailyLimit.previousClientId])].sort((a, b) => a - b)) {
        await tx.$executeRaw`UPDATE clients SET updatedAt = updatedAt WHERE id = ${clientId}`;
      }
      await assertClosedWindowWritable(tx, dailyLimit.userId, dailyLimit.previousClientId, dailyLimit.previousDate);
      await assertClosedWindowWritable(tx, dailyLimit.userId, nextClientId, dailyLimit.date);
      if (dailyLimit) await assertAtomicDailyLimit(tx, dailyLimit.userId,
        dailyLimit.date, dailyLimit.durationMinutes, id);
      try {
        return await tx.timeEntry.update({ where: { id, deletedAt: null,
          updatedAt: this.expectedUpdatedAt ?? dailyLimit.expectedUpdatedAt }, data }) as ITimeEntry;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new ConflictError('ENTRY_VERSION_CONFLICT');
        throw error;
      }
    });
  }

  async deleteTimeEntry(id: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.timeEntry.findUnique({ where: { id } });
      if (!entry) throw new NotFoundError('Time entry not found');
      await assertClosedWindowWritable(tx, entry.userId, entry.clientId, entry.date);
      await tx.timeEntry.update({ where: { id, deletedAt: null,
        updatedAt: this.expectedUpdatedAt ?? entry.updatedAt }, data: { deletedAt: new Date() } });
    });
  }

  createBulkTimeEntries(
    userId: number,
    entries: Array<{
      clientId: number;
      date: Date;
      activityDescription: string;
      durationMinutes: number;
      projectId?: number | null;
    }>,
    source: TimeEntrySource = 'PORTAL'
  ): Promise<ITimeEntry[]> {
    return prisma.$transaction(async (tx) => {
      for (const clientId of [...new Set(entries.map((entry) => entry.clientId))].sort((a, b) => a - b)) {
        await tx.$executeRaw`UPDATE clients SET updatedAt = updatedAt WHERE id = ${clientId}`;
      }
      for (const entry of entries) await assertClosedWindowWritable(tx, userId, entry.clientId, entry.date);
      const totals = new Map<string, { date: Date; minutes: number }>();
      for (const entry of entries) {
        const key = entry.date.toISOString();
        totals.set(key, { date: entry.date, minutes: (totals.get(key)?.minutes ?? 0) + entry.durationMinutes });
      }
      for (const value of totals.values()) {
        await assertAtomicDailyLimit(tx, userId, value.date, value.minutes);
      }
      return Promise.all(entries.map((entry) =>
        tx.timeEntry.create({
          data: {
            userId,
            clientId: entry.clientId,
            date: entry.date,
            activityDescription: entry.activityDescription,
            durationMinutes: entry.durationMinutes,
            projectId: entry.projectId ?? null,
            source,
          },
        })
      )) as Promise<ITimeEntry[]>;
    });
  }

  async aggregateMonthMinutes(userId: number, startDate: Date, endDate: Date): Promise<number> {
    const result = await prisma.timeEntry.aggregate({
      where: { userId, date: { gte: startDate, lte: endDate } },
      _sum: { durationMinutes: true },
    });
    return result._sum.durationMinutes ?? 0;
  }

  async aggregateClientMonthMinutes(
    userId: number,
    clientId: number,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await prisma.timeEntry.aggregate({
      where: { userId, clientId, date: { gte: startDate, lte: endDate } },
      _sum: { durationMinutes: true },
    });

    return result._sum.durationMinutes ?? 0;
  }

  async groupMonthMinutesByClient(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ clientId: number; minutes: number }>> {
    const grouped = await prisma.timeEntry.groupBy({
      by: ['clientId'],
      where: { userId, date: { gte: startDate, lte: endDate } },
      _sum: { durationMinutes: true },
    });
    return grouped.map((item) => ({
      clientId: item.clientId,
      minutes: item._sum.durationMinutes ?? 0,
    }));
  }

  findClientsByIds(ids: number[]): Promise<TimeEntryClientSnapshot[]> {
    return prisma.client.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        paysOvertime: true,
        lockDay: true,
        requireProjectOnEntries: true,
      },
    }) as Promise<TimeEntryClientSnapshot[]>;
  }

  async createAuditLog(data: {
    userId: number | null;
    endpoint: string;
    action: string;
    status: string;
    details: string | null;
  }): Promise<void> {
    await prisma.auditLog.create({ data });
  }

  findAllowedSupervisedUser(userId: number, roleIds: number[]): Promise<{ id: number } | null> {
    return prisma.user.findFirst({
      where: { id: userId, roleId: { in: roleIds } },
      select: { id: true },
    });
  }

  async queryManagerSupervisedEntryIds(
    params: SupervisedManagerEntryQuery
  ): Promise<{ ids: number[]; total: number }> {
    const conditions: Prisma.Sql[] = [Prisma.sql`u.roleId = 3`, Prisma.sql`te.deletedAt IS NULL`];
    conditions.push(Prisma.sql`(u.managerId = ${params.actorUserId} OR mah.id IS NOT NULL)`);
    if (params.userId) conditions.push(Prisma.sql`te.userId = ${params.userId}`);
    if (params.clientId) conditions.push(Prisma.sql`te.clientId = ${params.clientId}`);
    if (params.startDate) conditions.push(Prisma.sql`te.date >= ${params.startDate}`);
    if (params.endDate) conditions.push(Prisma.sql`te.date <= ${params.endDate}`);

    const whereSql =
      conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const [idRows, totalRows] = await Promise.all([
      prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT te.id
        FROM time_entries te
        INNER JOIN users u ON u.id = te.userId
        LEFT JOIN manager_assignment_history mah
          ON mah.consultantId = te.userId
          AND mah.managerId = ${params.actorUserId}
          AND mah.startDate <= te.date
          AND (mah.endDate IS NULL OR mah.endDate >= te.date)
        ${whereSql}
        ORDER BY te.date DESC, te.id DESC
        LIMIT ${params.limit}
        OFFSET ${(params.page - 1) * params.limit}
      `),
      prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*) as total
        FROM time_entries te
        INNER JOIN users u ON u.id = te.userId
        LEFT JOIN manager_assignment_history mah
          ON mah.consultantId = te.userId
          AND mah.managerId = ${params.actorUserId}
          AND mah.startDate <= te.date
          AND (mah.endDate IS NULL OR mah.endDate >= te.date)
        ${whereSql}
      `),
    ]);

    return {
      ids: idRows.map((row) => Number(row.id)),
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async findEntriesWithRelationsByIds(ids: number[]): Promise<SupervisedTimeEntryRow[]> {
    const rows = await prisma.timeEntry.findMany({
      where: { id: { in: ids } },
      include: {
        user: { select: { id: true, name: true, email: true, roleId: true } },
        client: { select: { id: true, name: true, lockDay: true } },
      },
    });

    const orderIndex = new Map(ids.map((id, index) => [id, index]));
    rows.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

    return rows as SupervisedTimeEntryRow[];
  }

  async findSupervisedEntriesForAdmin(
    params: SupervisedAdminEntryQuery
  ): Promise<{ rows: SupervisedTimeEntryRow[]; total: number }> {
    const where = {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(params.startDate || params.endDate
        ? {
            date: {
              ...(params.startDate ? { gte: params.startDate } : {}),
              ...(params.endDate ? { lte: params.endDate } : {}),
            },
          }
        : {}),
      user: { roleId: { in: params.roleIds } },
    };

    const [rows, total] = await Promise.all([
      prisma.timeEntry.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, roleId: true } },
          client: { select: { id: true, name: true, lockDay: true } },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.timeEntry.count({ where }),
    ]);

    return { rows: rows as SupervisedTimeEntryRow[], total };
  }

  findManagedConsultants(
    managerId: number
  ): Promise<Array<{ id: number; name: string; email: string }>> {
    return prisma.user.findMany({
      where: { managerId },
      select: { id: true, name: true, email: true },
    });
  }
}

export const timeEntryRepository = new PrismaTimeEntryRepository();
