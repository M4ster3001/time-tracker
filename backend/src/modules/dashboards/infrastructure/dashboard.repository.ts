import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { getMonthRangeUTC } from '../../../shared/domain/date.js';
import type { ITimeEntry } from '../../time-tracking/domain/time-entry.types.js';

export const parseDateInputToUTC = (value: string): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

export const formatDateKeyUTC = (value: Date): string =>
  `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(
    value.getUTCDate()
  ).padStart(2, '0')}`;

export const resolveDashboardRange = (
  year: number,
  month: number,
  startDate?: string,
  endDate?: string
): { start: Date; end: Date } => {
  const monthRange = getMonthRangeUTC(year, month);
  const parsedStart = parseDateInputToUTC(startDate || '');
  const parsedEnd = parseDateInputToUTC(endDate || '');
  const start = parsedStart ?? monthRange.start;
  const end = parsedEnd
    ? new Date(
        Date.UTC(
          parsedEnd.getUTCFullYear(),
          parsedEnd.getUTCMonth(),
          parsedEnd.getUTCDate(),
          23,
          59,
          59,
          999
        )
      )
    : monthRange.end;

  return { start, end };
};

export const dashboardRepository = {
  async getUserMonthEntries(
    userId: number,
    year: number,
    month: number,
    clientId?: number
  ): Promise<ITimeEntry[]> {
    const range = getMonthRangeUTC(year, month);
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId,
        ...(clientId ? { clientId } : {}),
        date: { gte: range.start, lte: range.end },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
    return entries as ITimeEntry[];
  },

  async getDailyEntries(userIds: number[], start: Date, end: Date, clientId?: number) {
    if (userIds.length === 0) return [];
    return prisma.timeEntry.findMany({
      where: {
        userId: { in: userIds },
        ...(clientId ? { clientId } : {}),
        date: { gte: start, lte: end },
      },
      select: {
        id: true,
        userId: true,
        date: true,
        durationMinutes: true,
        activityDescription: true,
        client: { select: { id: true, name: true } },
        user: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });
  },

  async findClientsByIds(ids: number[]) {
    if (ids.length === 0) return [];
    return prisma.client.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, paysOvertime: true },
    });
  },

  async findConsultantsByIds(ids: number[], consultantId?: number) {
    return prisma.user.findMany({
      where: {
        id: { in: ids.length > 0 ? ids : [-1] },
        ...(consultantId ? { id: consultantId } : {}),
      },
      select: { id: true, name: true },
    });
  },

  countConsultants() {
    return prisma.user.count({ where: { roleId: 3 } });
  },

  async getEntriesForRange(start: Date, end: Date) {
    return prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end } },
      select: { userId: true, clientId: true, durationMinutes: true },
    });
  },

  getActiveConsultants() {
    return prisma.user.findMany({
      where: { roleId: 3, deletedAt: null },
      select: { id: true, name: true },
    });
  },

  async findUsersByIds(ids: number[]) {
    if (ids.length === 0) return [];
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  },
};
