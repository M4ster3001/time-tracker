import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../shared/infrastructure/db/prisma.js';
import { getConsultantDashboard } from '../services/dashboard.service.js';
import { getExportData } from '../services/admin.export.service.js';

vi.mock('../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    user: { findMany: vi.fn() },
    userClient: { findMany: vi.fn() },
    timeEntry: { findMany: vi.fn() },
    client: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

describe('Business Rules E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mantem consistencia entre dashboard e export no mes calendario com regra de alocacao', async () => {
    vi.mocked(prisma.userClient.findMany).mockResolvedValue([
      { userId: 1, clientId: 10, client: { isActive: true } },
      { userId: 1, clientId: 20, client: { isActive: true } },
      { userId: 1, clientId: 30, client: { isActive: true } },
    ] as any);

    vi.mocked(prisma.timeEntry.findMany)
      // Dashboard overview (mes calendario fevereiro)
      .mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          clientId: 10,
          date: new Date('2026-02-05T00:00:00.000Z'),
          activityDescription: 'A',
          durationMinutes: 480,
        },
        {
          id: 2,
          userId: 1,
          clientId: 20,
          date: new Date('2026-02-06T00:00:00.000Z'),
          activityDescription: 'B',
          durationMinutes: 120,
        },
        {
          id: 3,
          userId: 1,
          clientId: 30,
          date: new Date('2026-02-07T00:00:00.000Z'),
          activityDescription: 'C',
          durationMinutes: 90,
        },
        {
          id: 4,
          userId: 1,
          clientId: 10,
          date: new Date('2026-02-12T00:00:00.000Z'),
          activityDescription: 'D',
          durationMinutes: 480,
        },
      ] as any)
      // Daily breakdown
      .mockResolvedValueOnce([] as any)
      // Clients with activity (for cycle access scope)
      .mockResolvedValueOnce([{ clientId: 10 }, { clientId: 20 }, { clientId: 30 }] as any)
      // Cycle summary range
      .mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          clientId: 10,
          date: new Date('2026-02-05T00:00:00.000Z'),
          activityDescription: 'A',
          durationMinutes: 480,
        },
        {
          id: 2,
          userId: 1,
          clientId: 20,
          date: new Date('2026-02-06T00:00:00.000Z'),
          activityDescription: 'B',
          durationMinutes: 120,
        },
        {
          id: 3,
          userId: 1,
          clientId: 30,
          date: new Date('2026-02-07T00:00:00.000Z'),
          activityDescription: 'C',
          durationMinutes: 90,
        },
        {
          id: 4,
          userId: 1,
          clientId: 10,
          date: new Date('2026-02-12T00:00:00.000Z'),
          activityDescription: 'D',
          durationMinutes: 480,
        },
      ] as any)
      // Export query findMany
      .mockResolvedValueOnce([
        {
          userId: 1,
          clientId: 10,
          date: new Date('2026-02-12T00:00:00.000Z'),
          activityDescription: 'E',
          durationMinutes: 480,
          user: { name: 'Aldo' },
          client: { name: 'HOR' },
        },
      ] as any);

    vi.mocked(prisma.client.findMany).mockResolvedValue([
      { id: 10, name: 'HOR', paysOvertime: true },
      { id: 20, name: 'Martins', paysOvertime: true },
      { id: 30, name: 'Sem alocacao', paysOvertime: true },
    ] as any);

    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { clientId: 10, allocationType: 'MONTHLY', hoursPerDay: null, hoursPerMonth: 8 },
    ] as any);

    const dashboard = await getConsultantDashboard(1, 2026, 2);
    const exported = await getExportData({ year: 2026, month: 2, consultantId: 1 });

    // Cliente com alocacao (8h no mes): 16h lancadas => 8h extra.
    // Clientes sem alocacao: 2h + 1h30 = 3h30 extras.
    expect(dashboard.overtimeMinutes).toBe(690);
    expect(dashboard.totalMinutes).toBe(1170);
    expect(exported.every((item) => item.date >= new Date('2026-02-01T00:00:00.000Z'))).toBe(true);
    expect(exported.every((item) => item.date <= new Date('2026-02-28T23:59:59.999Z'))).toBe(true);
  });
});
