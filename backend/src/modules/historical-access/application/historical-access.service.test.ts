import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  canManagerAccessConsultantOnDate,
  getAccessibleClientIdsForConsultant,
  getManagedConsultantIds,
  syncManagerAssignmentHistory,
} from './historical-access.service.js';

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    userClient: {
      findMany: vi.fn(),
    },
    timeEntry: {
      groupBy: vi.fn(),
      findFirst: vi.fn(),
    },
    managerAssignmentHistory: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

describe('HistoricalAccessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.userClient.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValue([] as any);
    vi.mocked(prisma.timeEntry.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.managerAssignmentHistory.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.managerAssignmentHistory.update).mockResolvedValue({} as any);
    vi.mocked(prisma.managerAssignmentHistory.create).mockResolvedValue({} as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as any);
  });

  it('combina consultores atuais e historicos do manager', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 10 }] as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ consultantId: 11 }] as any);

    const ids = await getManagedConsultantIds(2);

    expect(ids.sort((a, b) => a - b)).toEqual([10, 11]);
  });

  it('permite acesso historico por data', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        startDate: new Date('2026-02-01T00:00:00.000Z'),
        endDate: null,
      },
    ] as any);

    const allowed = await canManagerAccessConsultantOnDate(2, 8, new Date('2026-02-05'));

    expect(allowed).toBe(true);
  });

  it('retorna clientes acessiveis do consultor unindo vinculo atual e historico', async () => {
    vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([{ clientId: 1 }] as any);
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([{ clientId: 2 }] as any);

    const ids = await getAccessibleClientIdsForConsultant(7);

    expect(ids.sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('fecha vinculo anterior e abre novo na troca de manager', async () => {
    vi.mocked(prisma.managerAssignmentHistory.findFirst)
      .mockResolvedValueOnce({
        id: 1,
        consultantId: 12,
        managerId: 3,
        startDate: new Date('2026-02-01T00:00:00.000Z'),
        endDate: null,
      } as any)
      .mockResolvedValueOnce(null as any);

    await syncManagerAssignmentHistory({
      consultantId: 12,
      previousManagerId: 3,
      nextManagerId: 4,
      effectiveDate: new Date('2026-02-24T00:00:00.000Z'),
    });

    expect(prisma.managerAssignmentHistory.update).toHaveBeenCalledTimes(1);
    expect(prisma.managerAssignmentHistory.create).toHaveBeenCalledTimes(1);
  });
});
