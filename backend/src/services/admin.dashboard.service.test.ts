import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../shared/infrastructure/db/prisma.js';
import * as adminDashboardService from './admin.dashboard.service.js';

vi.mock('../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    userClient: {
      findMany: vi.fn(),
    },
    timeEntry: {
      findMany: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

describe('AdminDashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar indicadores do admin', async () => {
    vi.mocked(prisma.user.count).mockResolvedValueOnce(2 as any);
    vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
      { userId: 1, clientId: 1, client: { lockDay: null, paysOvertime: true, name: 'Cliente A' } },
      { userId: 2, clientId: 2, client: { lockDay: null, paysOvertime: true, name: 'Cliente B' } },
    ] as any);
    vi.mocked(prisma.timeEntry.findMany).mockResolvedValue([
      {
        userId: 1,
        clientId: 1,
        durationMinutes: 300,
        date: new Date('2024-01-10T00:00:00.000Z'),
        client: { id: 1, name: 'Cliente A' },
        user: { name: 'Maria' },
      },
      {
        userId: 2,
        clientId: 2,
        durationMinutes: 300,
        date: new Date('2024-01-11T00:00:00.000Z'),
        client: { id: 2, name: 'Cliente B' },
        user: { name: 'Pedro' },
      },
    ] as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.client.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 1, name: 'Maria' },
      { id: 2, name: 'Pedro' },
    ] as any);

    const result = await adminDashboardService.getAdminDashboard(2024, 1);

    expect(result.totalConsultants).toBe(2);
    expect(result.totalHours).toBe(10);
    expect(result.topClients).toHaveLength(2);
  });

  it('deve retornar indicadores vazios quando nao ha dados', async () => {
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0 as any);
    vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.timeEntry.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.client.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as any);

    const result = await adminDashboardService.getAdminDashboard(2024, 1);

    expect(result.totalConsultants).toBe(0);
    expect(result.totalHours).toBe(0);
    expect(result.progressPercent).toBe(0);
    expect(result.topClients).toHaveLength(0);
    expect(result.topConsultants).toHaveLength(0);
    expect(result.overtimeByClient).toHaveLength(0);
    expect(result.overtimeByConsultant).toHaveLength(0);
  });

  it('deve calcular overtime acima da meta configurada', async () => {
    vi.mocked(prisma.user.count).mockResolvedValueOnce(1 as any);
    vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
      { userId: 1, clientId: 1, client: { lockDay: null, paysOvertime: true, name: 'Cliente A' } },
    ] as any);
    vi.mocked(prisma.timeEntry.findMany).mockResolvedValue([
      {
        userId: 1,
        clientId: 1,
        durationMinutes: 20000,
        date: new Date('2024-01-10T00:00:00.000Z'),
        client: { id: 1, name: 'Cliente A' },
        user: { name: 'Maria' },
      },
    ] as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        userId: 1,
        clientId: 1,
        allocationType: 'DAILY',
        hoursPerDay: 0.1,
        hoursPerMonth: null,
      },
    ] as any);
    vi.mocked(prisma.client.findMany).mockResolvedValue([
      { id: 1, name: 'Cliente A', paysOvertime: true },
    ] as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 1, name: 'Maria' }] as any);

    const result = await adminDashboardService.getAdminDashboard(2024, 1);

    expect(result.overtimeByClient).toHaveLength(1);
    expect(result.overtimeByConsultant).toHaveLength(1);
    expect(result.overtimeMinutes).toBeGreaterThan(0);
  });
});
