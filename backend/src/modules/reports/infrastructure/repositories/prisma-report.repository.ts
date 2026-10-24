import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type {
  ClientCapacityData,
  ConsultantPerformanceData,
  ExportEntryRow,
  ReportAllocationRow,
  ReportClientSnapshot,
  ReportRepository,
  ReportUserSnapshot,
} from '../../domain/repositories/report.repository.js';
import { getMonthRangeUTC } from '../../../../shared/domain/date.js';

const toNullableNumber = (value: Prisma.Decimal | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
};

const userSelect = {
  id: true,
  roleId: true,
  name: true,
  email: true,
  managerId: true,
  isActive: true,
  deletedAt: true,
  manager: { select: { id: true, name: true } },
} as const;

const clientSelect = {
  id: true,
  name: true,
  code: true,
  isActive: true,
  deletedAt: true,
  paysOvertime: true,
} as const;

const mapUser = (user: {
  id: number;
  roleId: number;
  name: string;
  email: string;
  managerId: number | null;
  isActive: boolean;
  deletedAt: Date | null;
  manager: { id: number; name: string } | null;
}): ReportUserSnapshot => ({
  id: user.id,
  roleId: user.roleId,
  name: user.name,
  email: user.email,
  managerId: user.managerId,
  isActive: user.isActive,
  deletedAt: user.deletedAt,
  manager: user.manager,
});

const mapClient = (client: {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  deletedAt: Date | null;
  paysOvertime: boolean;
}): ReportClientSnapshot => ({
  id: client.id,
  name: client.name,
  code: client.code,
  isActive: client.isActive,
  deletedAt: client.deletedAt,
  paysOvertime: client.paysOvertime,
});

export class PrismaReportRepository implements ReportRepository {
  async getConsultantPerformanceData(filters: {
    clientId?: number;
    startDate: Date;
    endDate: Date;
  }): Promise<ConsultantPerformanceData> {
    const [baseConsultants, entries, allocations] = await Promise.all([
      prisma.user.findMany({
        where: { roleId: 3, deletedAt: null },
        select: userSelect,
      }),
      prisma.timeEntry.findMany({
        where: {
          date: { gte: filters.startDate, lte: filters.endDate },
          ...(filters.clientId ? { clientId: filters.clientId } : {}),
        },
        select: {
          userId: true,
          clientId: true,
          date: true,
          durationMinutes: true,
          user: { select: userSelect },
          client: { select: clientSelect },
        },
      }),
      prisma.clientAllocation.findMany({
        where: filters.clientId ? { clientId: filters.clientId } : undefined,
        select: {
          userId: true,
          clientId: true,
          allocationType: true,
          hoursPerDay: true,
          hoursPerMonth: true,
          hourlyRate: true,
          user: { select: userSelect },
          client: { select: clientSelect },
        },
      }),
    ]);

    return {
      baseConsultants: baseConsultants.map(mapUser),
      entries: entries.map((entry) => ({
        ...entry,
        user: mapUser(entry.user),
        client: mapClient(entry.client),
      })) as ConsultantPerformanceData['entries'],
      allocations: allocations.map((allocation) => ({
        ...allocation,
        hourlyRate: toNullableNumber(allocation.hourlyRate),
        user: mapUser(allocation.user),
        client: mapClient(allocation.client),
      })) as ReportAllocationRow[],
    };
  }

  async getClientCapacityData(filters: {
    clientId?: number;
    startDate: Date;
    endDate: Date;
    includeInactive?: boolean;
  }): Promise<ClientCapacityData> {
    const [baseClients, entries, allocations] = await Promise.all([
      prisma.client.findMany({
        where: {
          deletedAt: null,
          ...(filters.clientId ? { id: filters.clientId } : {}),
          ...(filters.includeInactive ? {} : { isActive: true }),
        },
        select: clientSelect,
      }),
      prisma.timeEntry.findMany({
        where: {
          date: { gte: filters.startDate, lte: filters.endDate },
          ...(filters.clientId ? { clientId: filters.clientId } : {}),
        },
        select: {
          userId: true,
          clientId: true,
          durationMinutes: true,
          user: {
            select: {
              id: true,
              name: true,
              roleId: true,
              deletedAt: true,
              isActive: true,
              email: true,
              managerId: true,
              manager: { select: { id: true, name: true } },
            },
          },
          client: { select: clientSelect },
        },
      }),
      prisma.clientAllocation.findMany({
        where: filters.clientId ? { clientId: filters.clientId } : undefined,
        select: {
          userId: true,
          clientId: true,
          allocationType: true,
          hoursPerDay: true,
          hoursPerMonth: true,
          hourlyRate: true,
          user: {
            select: {
              id: true,
              name: true,
              roleId: true,
              deletedAt: true,
              isActive: true,
              email: true,
              managerId: true,
              manager: { select: { id: true, name: true } },
            },
          },
          client: { select: clientSelect },
        },
      }),
    ]);

    return {
      baseClients: baseClients.map(mapClient),
      entries: entries.map((entry) => ({
        ...entry,
        user: mapUser({
          id: entry.user.id,
          roleId: entry.user.roleId,
          name: entry.user.name,
          email: entry.user.email ?? '',
          managerId: entry.user.managerId ?? null,
          isActive: entry.user.isActive ?? false,
          deletedAt: entry.user.deletedAt,
          manager: entry.user.manager ?? null,
        }),
        client: mapClient(entry.client),
      })) as ClientCapacityData['entries'],
      allocations: allocations.map((allocation) => ({
        ...allocation,
        hourlyRate: toNullableNumber(allocation.hourlyRate),
        user: mapUser({
          id: allocation.user.id,
          roleId: allocation.user.roleId,
          name: allocation.user.name,
          email: allocation.user.email ?? '',
          managerId: allocation.user.managerId ?? null,
          isActive: allocation.user.isActive ?? false,
          deletedAt: allocation.user.deletedAt,
          manager: allocation.user.manager ?? null,
        }),
        client: mapClient(allocation.client),
      })) as ReportAllocationRow[],
    };
  }

  async getExportData(filters: {
    month: number;
    year: number;
    consultantId?: number;
    clientId?: number;
    userIds?: number[];
  }): Promise<ExportEntryRow[]> {
    const monthRange = getMonthRangeUTC(filters.year, filters.month);
    const userWhere =
      filters.consultantId !== undefined
        ? filters.consultantId
        : filters.userIds && filters.userIds.length > 0
          ? { in: filters.userIds }
          : undefined;

    const entries = await prisma.timeEntry.findMany({
      where: {
        date: { gte: monthRange.start, lte: monthRange.end },
        ...(userWhere !== undefined ? { userId: userWhere } : {}),
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
      },
      include: {
        user: { select: { name: true, roleId: true } },
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });

    return entries.map((entry) => ({
      userId: entry.userId,
      roleId: entry.user.roleId,
      clientId: entry.clientId,
      date: entry.date,
      userName: entry.user.name,
      consultantName: entry.user.name,
      clientName: entry.client.name,
      projectName: entry.project?.name ?? null,
      activityDescription: entry.activityDescription,
      durationMinutes: entry.durationMinutes,
    }));
  }
}

export const reportRepository = new PrismaReportRepository();
