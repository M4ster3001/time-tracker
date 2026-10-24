import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  deleteConsultantAllocation,
  getAllocationTargetMinutes,
  listConsultantAllocations,
  upsertConsultantAllocation,
} from './allocation.service.js';

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
    userClient: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    clientAllocation: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    clientAllocationHistory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

describe('AllocationService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.clientAllocation.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.clientAllocationHistory.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.clientAllocationHistory.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.clientAllocationHistory.update).mockResolvedValue({} as any);
    vi.mocked(prisma.clientAllocationHistory.create).mockResolvedValue({} as any);
    vi.mocked(prisma.clientAllocationHistory.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.clientAllocation.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.clientAllocation.deleteMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (handler: any) => handler(prisma));
  });

  it('preserves the historical rate when an hours-only edit omits financial fields', async () => {
    const existing = { id: 4, userId: 1, clientId: 2, allocationType: 'DAILY', hoursPerDay: 4,
      hourlyRate: 125, effectiveFrom: new Date('2026-01-01'), effectiveTo: null };
    vi.mocked(prisma.userClient.findUnique).mockResolvedValue({ userId: 1, clientId: 2 } as any);
    vi.mocked(prisma.clientAllocationHistory.findFirst).mockResolvedValue(existing as any);
    await upsertConsultantAllocation({ consultantId: 1, clientId: 2, allocationType: 'DAILY', hoursPerDay: 6,
      effectiveFrom: new Date('2026-01-01') });
    expect(prisma.clientAllocationHistory.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hoursPerDay: 6, hourlyRate: 125 }),
    }));
  });

  it('lista alocacoes por cliente', async () => {
    vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
      { userId: 1, clientId: 10, client: { id: 10, name: 'Cliente A' } },
      { userId: 1, clientId: 11, client: { id: 11, name: 'Cliente B' } },
    ] as any);
    vi.mocked(prisma.clientAllocationHistory.findMany).mockResolvedValueOnce([
      {
        id: 1,
        userId: 1,
        clientId: 10,
        allocationType: 'DAILY',
        hoursPerDay: 4,
        hoursPerMonth: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const result = await listConsultantAllocations(1);

    expect(result).toHaveLength(2);
    expect(result[0].allocation?.allocationType).toBe('DAILY');
    expect(result[1].allocation).toBeNull();
  });

  it('valida alocacao diaria', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
      userId: 1,
      clientId: 1,
      createdAt: new Date(),
    } as any);

    await expect(
      upsertConsultantAllocation({
        consultantId: 1,
        clientId: 1,
        allocationType: 'DAILY',
        hoursPerDay: -1,
      })
    ).rejects.toThrow('Invalid daily allocation');
  });

  it('valida alocacao mensal', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
      userId: 1,
      clientId: 1,
      createdAt: new Date(),
    } as any);

    await expect(
      upsertConsultantAllocation({
        consultantId: 1,
        clientId: 1,
        allocationType: 'MONTHLY',
        hoursPerMonth: -1,
      })
    ).rejects.toThrow('Invalid monthly allocation');
  });

  it('valida valor/hora negativo', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
      userId: 1,
      clientId: 1,
      createdAt: new Date(),
    } as any);

    await expect(
      upsertConsultantAllocation({
        consultantId: 1,
        clientId: 1,
        allocationType: 'DAILY',
        hoursPerDay: 4,
        hourlyRate: -10,
      })
    ).rejects.toThrow('Invalid hourly rate');
  });

  it('aceita zero como alocacao valida (zera as horas sem remover o vinculo)', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
      userId: 1,
      clientId: 1,
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.clientAllocationHistory.findFirst).mockResolvedValueOnce(null as any);
    vi.mocked(prisma.clientAllocationHistory.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.clientAllocationHistory.findFirst).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      clientId: 1,
      allocationType: 'DAILY',
      hoursPerDay: 0,
      hoursPerMonth: null,
      effectiveFrom: new Date(),
      effectiveTo: null,
    } as any);

    await expect(
      upsertConsultantAllocation({
        consultantId: 1,
        clientId: 1,
        allocationType: 'DAILY',
        hoursPerDay: 0,
      })
    ).resolves.toBeDefined();
  });

  it('salva alocacao e retorna registro', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
      userId: 1,
      clientId: 1,
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.clientAllocationHistory.findFirst).mockResolvedValueOnce(null as any);
    vi.mocked(prisma.clientAllocationHistory.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.clientAllocationHistory.findFirst).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      clientId: 1,
      allocationType: 'MONTHLY',
      hoursPerDay: null,
      hoursPerMonth: 80,
      effectiveFrom: new Date(),
      effectiveTo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await upsertConsultantAllocation({
      consultantId: 1,
      clientId: 1,
      allocationType: 'MONTHLY',
      hoursPerMonth: 80,
    });

    expect(result.hoursPerMonth).toBe(80);
    expect(prisma.clientAllocation.upsert).toHaveBeenCalled();
  });

  it('salva alocacao diaria', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
      userId: 1,
      clientId: 1,
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.clientAllocationHistory.findFirst).mockResolvedValueOnce(null as any);
    vi.mocked(prisma.clientAllocationHistory.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.clientAllocationHistory.findFirst).mockResolvedValueOnce({
      id: 2,
      userId: 1,
      clientId: 1,
      allocationType: 'DAILY',
      hoursPerDay: 4,
      hoursPerMonth: null,
      effectiveFrom: new Date(),
      effectiveTo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await upsertConsultantAllocation({
      consultantId: 1,
      clientId: 1,
      allocationType: 'DAILY',
      hoursPerDay: 4,
    });

    expect(result.allocationType).toBe('DAILY');
  });

  it('remove alocacao existente', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
      userId: 1,
      clientId: 1,
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.clientAllocationHistory.findFirst).mockResolvedValueOnce({
      id: 9,
      userId: 1,
      clientId: 1,
      effectiveFrom: new Date('2026-04-01T00:00:00.000Z'),
      effectiveTo: null,
    } as any);

    await deleteConsultantAllocation(1, 1);

    expect(prisma.clientAllocation.deleteMany).toHaveBeenCalled();
  });

  it('bloqueia remocao sem acesso ao cliente', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce(null);

    await expect(deleteConsultantAllocation(1, 1)).rejects.toThrow(
      'User is not assigned to this client'
    );
  });

  it('bloqueia alteracao sem acesso ao cliente', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce(null);

    await expect(
      upsertConsultantAllocation({
        consultantId: 1,
        clientId: 1,
        allocationType: 'DAILY',
        hoursPerDay: 4,
      })
    ).rejects.toThrow('User is not assigned to this client');
  });

  it('calcula meta mensal por dia e por mes', () => {
    const daily = getAllocationTargetMinutes(
      { allocationType: 'DAILY', hoursPerDay: 4, hoursPerMonth: null },
      2024,
      1
    );
    const monthly = getAllocationTargetMinutes(
      { allocationType: 'MONTHLY', hoursPerDay: null, hoursPerMonth: 80 },
      2024,
      1
    );

    expect(daily).toBeGreaterThan(0);
    expect(monthly).toBe(80 * 60);
  });
});
