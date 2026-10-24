import { Prisma } from '@prisma/client';

import { prisma } from '../../../../shared/infrastructure/db/prisma.js';
import type { IClientAllocation } from '../../domain/allocation.types.js';
import type { AllocationRepository } from '../../domain/repositories/allocation.repository.js';
import type {
  ConsultantAllocationListItem,
  UpsertConsultantAllocationParams,
} from '../../domain/repositories/allocation.repository.types.js';

const toNullableNumber = (value: Prisma.Decimal | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
};

const normalizeAllocation = <T extends { hourlyRate: Prisma.Decimal | number | null }>(
  row: T
): T & { hourlyRate: number | null } => ({
  ...row,
  hourlyRate: toNullableNumber(row.hourlyRate),
});

const toAllocation = (row: IClientAllocation | null | undefined): IClientAllocation | null =>
  row ?? null;
const asDateOnly = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const previousDay = (value: Date): Date => {
  const next = asDateOnly(value);
  next.setUTCDate(next.getUTCDate() - 1);
  return next;
};

type PrismaTransaction = Prisma.TransactionClient;

const runInTransaction = async <T>(handler: (tx: PrismaTransaction) => Promise<T>): Promise<T> => {
  return prisma.$transaction((tx) => handler(tx));
};

export class PrismaAllocationRepository implements AllocationRepository {
  async hasUserClientLink(userId: number, clientId: number): Promise<boolean> {
    const link = await prisma.userClient.findUnique({
      where: { userId_clientId: { userId, clientId } },
      select: { userId: true },
    });
    return Boolean(link);
  }

  async hasManagerAccessToConsultant(managerId: number, consultantId: number): Promise<boolean> {
    if (managerId === consultantId) {
      return true;
    }

    const consultant = await prisma.user.findFirst({
      where: { id: consultantId, managerId },
      select: { id: true },
    });
    return Boolean(consultant);
  }

  async listConsultantAllocations(consultantId: number): Promise<ConsultantAllocationListItem[]> {
    const [links, openAllocations] = await Promise.all([
      prisma.userClient.findMany({
        where: { userId: consultantId },
        include: { client: true },
      }),
      prisma.clientAllocationHistory.findMany({
        where: { userId: consultantId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);

    const allocationByClient = new Map<number, IClientAllocation>();
    openAllocations.forEach((allocation) => {
      if (!allocationByClient.has(allocation.clientId)) {
        allocationByClient.set(
          allocation.clientId,
          normalizeAllocation(allocation) as IClientAllocation
        );
      }
    });

    return links.map((link) => ({
      clientId: link.clientId,
      clientName: link.client.name,
      allocation: toAllocation(allocationByClient.get(link.clientId)),
    }));
  }

  async upsertConsultantAllocation(
    params: UpsertConsultantAllocationParams
  ): Promise<IClientAllocation> {
    const effectiveFrom = asDateOnly(params.effectiveFrom);
    const nextHoursPerDay = params.allocationType === 'DAILY' ? (params.hoursPerDay ?? null) : null;
    const nextHoursPerMonth =
      params.allocationType === 'MONTHLY' ? (params.hoursPerMonth ?? null) : null;
    let nextHourlyRate = params.hourlyRate ?? null;

    const allocation = await runInTransaction(async (tx) => {
      await tx.$executeRaw`UPDATE clients SET updatedAt = updatedAt WHERE id = ${params.clientId}`;
      const overlap = await tx.clientAllocationHistory.findFirst({
        where: {
          userId: params.consultantId,
          clientId: params.clientId,
          effectiveFrom: { lte: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (params.hourlyRate === undefined) {
        const fallback = overlap ?? await tx.clientAllocation.findUnique({ where: { userId_clientId: {
          userId: params.consultantId, clientId: params.clientId } } });
        nextHourlyRate = toNullableNumber(fallback?.hourlyRate);
      }

      if (overlap && overlap.effectiveFrom.getTime() === effectiveFrom.getTime()) {
        await tx.clientAllocationHistory.update({
          where: { id: overlap.id },
          data: {
            allocationType: params.allocationType,
            hoursPerDay: nextHoursPerDay,
            hoursPerMonth: nextHoursPerMonth,
            hourlyRate: nextHourlyRate,
            createdBy: params.createdBy ?? null,
          },
        });
      } else {
        if (overlap) {
          await tx.clientAllocationHistory.update({
            where: { id: overlap.id },
            data: { effectiveTo: previousDay(effectiveFrom) },
          });
        }

        await tx.clientAllocationHistory.create({
          data: {
            userId: params.consultantId,
            clientId: params.clientId,
            allocationType: params.allocationType,
            hoursPerDay: nextHoursPerDay,
            hoursPerMonth: nextHoursPerMonth,
            hourlyRate: nextHourlyRate,
            effectiveFrom,
            effectiveTo: null,
            createdBy: params.createdBy ?? null,
          },
        });
      }

      const currentAllocation = await tx.clientAllocationHistory.findFirst({
        where: {
          userId: params.consultantId,
          clientId: params.clientId,
          effectiveTo: null,
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (currentAllocation) {
        await tx.clientAllocation.upsert({
          where: {
            userId_clientId: {
              userId: params.consultantId,
              clientId: params.clientId,
            },
          },
          create: {
            userId: params.consultantId,
            clientId: params.clientId,
            allocationType: currentAllocation.allocationType,
            hoursPerDay: currentAllocation.hoursPerDay,
            hoursPerMonth: currentAllocation.hoursPerMonth,
            hourlyRate: currentAllocation.hourlyRate,
          },
          update: {
            allocationType: currentAllocation.allocationType,
            hoursPerDay: currentAllocation.hoursPerDay,
            hoursPerMonth: currentAllocation.hoursPerMonth,
            hourlyRate: currentAllocation.hourlyRate,
          },
        });

        return normalizeAllocation(currentAllocation) as IClientAllocation;
      }

      await tx.clientAllocation.deleteMany({
        where: {
          userId: params.consultantId,
          clientId: params.clientId,
        },
      });

      return null;
    });

    if (allocation) {
      return allocation;
    }

    return {
      id: 0,
      userId: params.consultantId,
      clientId: params.clientId,
      allocationType: params.allocationType,
      hoursPerDay: nextHoursPerDay,
      hoursPerMonth: nextHoursPerMonth,
      hourlyRate: nextHourlyRate,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async deleteConsultantAllocation(consultantId: number, clientId: number): Promise<void> {
    await runInTransaction(async (tx) => {
      await tx.$executeRaw`UPDATE clients SET updatedAt = updatedAt WHERE id = ${clientId}`;
      const current = await tx.clientAllocationHistory.findFirst({
        where: { userId: consultantId, clientId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (current) {
        const today = asDateOnly(new Date());
        const effectiveFrom = asDateOnly(current.effectiveFrom);

        if (effectiveFrom.getTime() > today.getTime()) {
          await tx.clientAllocationHistory.delete({ where: { id: current.id } });
        } else {
          await tx.clientAllocationHistory.update({
            where: { id: current.id },
            data: { effectiveTo: previousDay(today) },
          });
        }
      }

      await tx.clientAllocation.deleteMany({
        where: { userId: consultantId, clientId },
      });
    });
  }

  async getAllocationAtDate(
    userId: number,
    clientId: number,
    date: Date
  ): Promise<IClientAllocation | null> {
    const row = await prisma.clientAllocationHistory.findFirst({
      where: {
        userId,
        clientId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return row ? (normalizeAllocation(row) as IClientAllocation) : null;
  }

  async getAllocationsInRange(
    userId: number,
    clientId: number,
    startDate: Date,
    endDate: Date
  ): Promise<IClientAllocation[]> {
    const rows = await prisma.clientAllocationHistory.findMany({
      where: {
        userId,
        clientId,
        effectiveFrom: { lte: endDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
      },
      orderBy: { effectiveFrom: 'asc' },
    });

    return rows.map((row) => normalizeAllocation(row) as IClientAllocation);
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

export const allocationRepository = new PrismaAllocationRepository();
