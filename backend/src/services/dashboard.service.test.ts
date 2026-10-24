import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as dashboardService from './dashboard.service.js';
import { prisma } from '../shared/infrastructure/db/prisma.js';
import { getWorkingDaysInMonth } from '../shared/domain/date.js';
import { getManagedConsultantIds } from '../modules/historical-access/application/historical-access.service.js';
import * as closingCycleService from '../modules/closing-cycle/application/closing-cycle.service.js';

vi.mock('../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    user: { findMany: vi.fn() },
    userClient: { findMany: vi.fn() },
    timeEntry: { findMany: vi.fn() },
    client: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../modules/historical-access/application/historical-access.service.js', () => ({
  getManagedConsultantIds: vi.fn(),
}));

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagedConsultantIds).mockResolvedValue([2, 3]);
  });

  describe('getConsultantDashboard', () => {
    it('deve retornar dados consolidados do consultor', async () => {
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValue([
        {
          id: 1,
          userId: 1,
          clientId: 1,
          date: new Date('2024-01-10T00:00:00.000Z'),
          activityDescription: 'Dev',
          durationMinutes: 360,
          client: { id: 1, name: 'Cliente A' },
          user: { name: 'Consultor A' },
        },
        {
          id: 2,
          userId: 1,
          clientId: 2,
          date: new Date('2024-01-12T00:00:00.000Z'),
          activityDescription: 'QA',
          durationMinutes: 240,
          client: { id: 2, name: 'Cliente B' },
          user: { name: 'Consultor A' },
        },
      ] as any);
      vi.mocked(prisma.client.findMany).mockResolvedValue([
        { id: 1, name: 'Cliente A', paysOvertime: true },
        { id: 2, name: 'Cliente B', paysOvertime: true },
      ] as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([] as any);

      const result = await dashboardService.getConsultantDashboard(1, 2024, 1);

      expect(result.totalMinutes).toBe(600);
      expect(result.totalHours).toBe(10);
      expect(result.targetHours).toBe(0);
      expect(result.byClient).toHaveLength(2);
      expect(result.entries).toHaveLength(2);
      expect(result.overtimeMinutes).toBe(600);
    });

    it('deve calcular overtime por regra de alocacao', async () => {
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValue([
        {
          id: 1,
          userId: 1,
          clientId: 1,
          date: new Date('2024-01-10T00:00:00.000Z'),
          activityDescription: 'A',
          durationMinutes: 12000,
          client: { id: 1, name: 'Cliente A' },
          user: { name: 'Consultor A' },
        },
        {
          id: 2,
          userId: 1,
          clientId: 2,
          date: new Date('2024-01-10T00:00:00.000Z'),
          activityDescription: 'B',
          durationMinutes: 8000,
          client: { id: 2, name: 'Cliente B' },
          user: { name: 'Consultor A' },
        },
      ] as any);
      vi.mocked(prisma.client.findMany).mockResolvedValue([
        { id: 1, name: 'Cliente A', paysOvertime: true },
        { id: 2, name: 'Cliente B', paysOvertime: true },
      ] as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { clientId: 1, allocationType: 'MONTHLY', hoursPerDay: null, hoursPerMonth: 100 },
      ] as any);

      const result = await dashboardService.getConsultantDashboard(1, 2024, 1);

      expect(result.overtimeMinutes).toBe(14000);
      expect(result.overtimeByClient).toHaveLength(2);
    });

    it('deve calcular meta mensal baseada nas alocacoes', async () => {
      const workingDays = getWorkingDaysInMonth(2024, 1);
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValue([
        {
          id: 1,
          userId: 1,
          clientId: 1,
          date: new Date('2024-01-10T00:00:00.000Z'),
          activityDescription: 'Dev',
          durationMinutes: 600,
          client: { id: 1, name: 'Cliente A' },
          user: { name: 'Consultor A' },
        },
      ] as any);
      vi.mocked(prisma.client.findMany).mockResolvedValue([
        { id: 1, name: 'Cliente A', paysOvertime: true },
        { id: 2, name: 'Cliente B', paysOvertime: true },
      ] as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { clientId: 1, allocationType: 'DAILY', hoursPerDay: 2, hoursPerMonth: null },
        { clientId: 2, allocationType: 'MONTHLY', hoursPerDay: null, hoursPerMonth: 10 },
      ] as any);

      const result = await dashboardService.getConsultantDashboard(1, 2024, 1);
      const expectedTargetHours = Math.round((workingDays * 2 + 10) * 100) / 100;

      expect(result.targetHours).toBe(expectedTargetHours);
      expect(result.progressPercent).toBeGreaterThan(0);
    });
  });

  describe('getManagerDashboard', () => {
    it('deve retornar consultores gerenciados', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { id: 2, name: 'Maria' },
        { id: 3, name: 'Pedro' },
      ] as any);
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.client.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([] as any);

      const result = await dashboardService.getManagerDashboard(1, 2024, 1);

      expect(result.consultants).toHaveLength(2);
      expect(result.consultants[0].name).toBe('Maria');
    });

    it('deve retornar lista vazia quando nao ha consultores', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);

      const result = await dashboardService.getManagerDashboard(1, 2024, 1, undefined, 10);
      expect(result.consultants).toEqual([]);
    });

    it('deve filtrar consultores por cliente quando ha alocacao', async () => {
      // getManagerDashboard filters via batched computeCycleSummariesForUsers
      // (dashboard.use-cases.ts), not userClient/$queryRaw per consultant.
      vi.spyOn(closingCycleService, 'computeCycleSummariesForUsers').mockResolvedValue(
        new Map([
          [
            2,
            {
              byClient: [
                {
                  clientId: 10,
                  clientName: 'Cliente X',
                  lockDay: 31,
                  closedCycle: {
                    startDate: '2024-01-01',
                    endDate: '2024-01-31',
                    workedMinutes: 0,
                    targetMinutes: 2400,
                    normalMinutes: 0,
                    overtimeMinutes: 0,
                    isClosed: true,
                  },
                  nextCyclePreview: {
                    startDate: '2024-02-01',
                    endDate: '2024-02-29',
                    workedMinutes: 0,
                    targetMinutes: 0,
                    normalMinutes: 0,
                    overtimeMinutes: 0,
                    isClosed: false,
                  },
                },
              ],
              totals: {
                closedCycle: {
                  workedMinutes: 0,
                  targetMinutes: 2400,
                  normalMinutes: 0,
                  overtimeMinutes: 0,
                },
                nextCyclePreview: {
                  workedMinutes: 0,
                  targetMinutes: 0,
                  normalMinutes: 0,
                  overtimeMinutes: 0,
                },
              },
            },
          ],
          [
            3,
            {
              byClient: [],
              totals: {
                closedCycle: {
                  workedMinutes: 0,
                  targetMinutes: 0,
                  normalMinutes: 0,
                  overtimeMinutes: 0,
                },
                nextCyclePreview: {
                  workedMinutes: 0,
                  targetMinutes: 0,
                  normalMinutes: 0,
                  overtimeMinutes: 0,
                },
              },
            },
          ],
        ])
      );
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { id: 2, name: 'Maria' },
        { id: 3, name: 'Pedro' },
      ] as any);
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.client.findMany).mockResolvedValue([
        { id: 10, name: 'Cliente X', paysOvertime: true },
      ] as any);

      const result = await dashboardService.getManagerDashboard(1, 2024, 1, undefined, 10);

      expect(closingCycleService.computeCycleSummariesForUsers).toHaveBeenCalledWith({
        userIds: [2, 3],
        year: 2024,
        month: 1,
        clientId: 10,
      });
      expect(result.consultants).toHaveLength(1);
      expect(result.consultants[0].id).toBe(2);
      expect(result.consultants[0].byClient[0].clientId).toBe(10);
    });
  });
});
