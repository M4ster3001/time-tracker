import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../shared/infrastructure/db/prisma.js';
import { getExportData } from './admin.export.service.js';

vi.mock('../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    timeEntry: {
      findMany: vi.fn(),
    },
  },
}));

describe('AdminExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mapeia dados de exportacao no mes calendario', async () => {
    vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce([
      {
        userId: 1,
        clientId: 2,
        date: new Date('2024-02-10T00:00:00.000Z'),
        activityDescription: 'Atividade',
        durationMinutes: 120,
        user: { name: 'Maria', roleId: 3 },
        client: { name: 'Cliente A' },
      },
    ] as any);

    const result = await getExportData({ month: 2, year: 2024 });

    expect(result).toHaveLength(1);
    expect(result[0].roleId).toBe(3);
    expect(result[0].userName).toBe('Maria');
    expect(result[0].consultantName).toBe('Maria');
    expect(result[0].clientName).toBe('Cliente A');
    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date('2024-02-01T00:00:00.000Z'),
            lte: new Date('2024-02-29T00:00:00.000Z'),
          },
        }),
      })
    );
  });

  it('aplica filtros de consultor e cliente no userClient', async () => {
    vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce([] as any);

    await getExportData({ month: 1, year: 2024, consultantId: 5, clientId: 9 });

    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 5,
          clientId: 9,
        }),
      })
    );
  });

  it('aplica filtro por lista de usuarios no userClient', async () => {
    vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce([] as any);

    await getExportData({ month: 1, year: 2024, userIds: [1, 2] });

    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { in: [1, 2] },
        }),
      })
    );
  });

  it('prioriza consultantId quando consultantId e userIds estao presentes', async () => {
    vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce([] as any);

    await getExportData({ month: 1, year: 2024, consultantId: 9, userIds: [1, 2, 9] });

    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 9,
        }),
      })
    );
  });
});
