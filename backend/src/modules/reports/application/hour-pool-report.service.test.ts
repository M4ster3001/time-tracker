import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getHourPoolReport } from './hour-pool-report.service.js';
import { reportRepository } from '../infrastructure/repositories/prisma-report.repository.js';
import { computeCycleSummaryForUser } from '../../closing-cycle/application/closing-cycle.service.js';

vi.mock('../infrastructure/repositories/prisma-report.repository.js', () => ({
  reportRepository: {
    getConsultantPerformanceData: vi.fn(),
  },
}));

vi.mock('../../closing-cycle/application/closing-cycle.service.js', () => ({
  computeCycleSummaryForUser: vi.fn(),
}));

const baseConsultant = { id: 1, name: 'Maria', email: 'test-user-1@example.test', roleId: 3 };

const cycleSummaryWithClient = (overrides: Record<string, unknown> = {}) => ({
  byClient: [
    {
      clientId: 10,
      clientName: 'Empresa X',
      lockDay: 20,
      closedCycle: {
        startDate: '2026-06-21',
        endDate: '2026-07-20',
        workedMinutes: 600,
        targetMinutes: 480,
        normalMinutes: 480,
        overtimeMinutes: 120,
        isClosed: true,
        ...overrides,
      },
      nextCyclePreview: {
        startDate: '2026-07-21',
        endDate: '2026-07-31',
        workedMinutes: 0,
        targetMinutes: 0,
        normalMinutes: 0,
        overtimeMinutes: 0,
        isClosed: false,
      },
    },
  ],
  totals: {
    closedCycle: { workedMinutes: 600, targetMinutes: 480, normalMinutes: 480, overtimeMinutes: 120 },
    nextCyclePreview: { workedMinutes: 0, targetMinutes: 0, normalMinutes: 0, overtimeMinutes: 0 },
  },
});

describe('hour-pool-report.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reportRepository.getConsultantPerformanceData).mockResolvedValue({
      baseConsultants: [baseConsultant],
      entries: [],
      allocations: [
        {
          userId: 1,
          clientId: 10,
          allocationType: 'MONTHLY',
          hoursPerDay: null,
          hoursPerMonth: 160,
          hourlyRate: 150,
          user: baseConsultant,
          client: { id: 10, name: 'Empresa X', code: 'EMP-X', isActive: true, deletedAt: null, paysOvertime: true },
        },
      ],
    } as any);
  });

  it('fatura todas as horas (normais + extras) quando o cliente paga hora extra', async () => {
    vi.mocked(computeCycleSummaryForUser).mockResolvedValue(cycleSummaryWithClient() as any);

    const result = await getHourPoolReport({ year: 2026, month: 7 });

    expect(result).toHaveLength(1);
    expect(result[0].workedHours).toBe(10);
    expect(result[0].overtimeHours).toBe(2);
    expect(result[0].billableHours).toBe(10);
    expect(result[0].billableAmount).toBe(1500);
  });

  it('exclui a hora extra do valor faturavel quando o cliente nao paga hora extra', async () => {
    vi.mocked(reportRepository.getConsultantPerformanceData).mockResolvedValue({
      baseConsultants: [baseConsultant],
      entries: [],
      allocations: [
        {
          userId: 1,
          clientId: 10,
          allocationType: 'MONTHLY',
          hoursPerDay: null,
          hoursPerMonth: 160,
          hourlyRate: 150,
          user: baseConsultant,
          client: { id: 10, name: 'Empresa X', code: 'EMP-X', isActive: true, deletedAt: null, paysOvertime: false },
        },
      ],
    } as any);
    vi.mocked(computeCycleSummaryForUser).mockResolvedValue(cycleSummaryWithClient() as any);

    const result = await getHourPoolReport({ year: 2026, month: 7 });

    expect(result[0].workedHours).toBe(10);
    expect(result[0].billableHours).toBe(8);
    expect(result[0].billableAmount).toBe(1200);
  });

  it('retorna billableAmount null quando nao ha hourlyRate cadastrado', async () => {
    vi.mocked(reportRepository.getConsultantPerformanceData).mockResolvedValue({
      baseConsultants: [baseConsultant],
      entries: [],
      allocations: [
        {
          userId: 1,
          clientId: 10,
          allocationType: 'MONTHLY',
          hoursPerDay: null,
          hoursPerMonth: 160,
          hourlyRate: null,
          user: baseConsultant,
          client: { id: 10, name: 'Empresa X', code: 'EMP-X', isActive: true, deletedAt: null, paysOvertime: true },
        },
      ],
    } as any);
    vi.mocked(computeCycleSummaryForUser).mockResolvedValue(cycleSummaryWithClient() as any);

    const result = await getHourPoolReport({ year: 2026, month: 7 });

    expect(result[0].hourlyRate).toBeNull();
    expect(result[0].billableAmount).toBeNull();
  });

  it('omite clientes sem horas trabalhadas nem meta no ciclo fechado', async () => {
    vi.mocked(computeCycleSummaryForUser).mockResolvedValue(
      cycleSummaryWithClient({ workedMinutes: 0, targetMinutes: 0, normalMinutes: 0, overtimeMinutes: 0 }) as any
    );

    const result = await getHourPoolReport({ year: 2026, month: 7 });

    expect(result).toHaveLength(0);
  });

  it('filtra por clientId quando informado', async () => {
    vi.mocked(computeCycleSummaryForUser).mockResolvedValue(cycleSummaryWithClient() as any);

    await getHourPoolReport({ year: 2026, month: 7, clientId: 10 });

    expect(reportRepository.getConsultantPerformanceData).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 10 })
    );
    expect(computeCycleSummaryForUser).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 10 })
    );
  });

  it('filtra por consultantId sem chamar o closing-cycle para os demais consultores', async () => {
    vi.mocked(reportRepository.getConsultantPerformanceData).mockResolvedValue({
      baseConsultants: [baseConsultant, { id: 2, name: 'Joao', email: 'test-user-2@example.test', roleId: 3 }],
      entries: [],
      allocations: [],
    } as any);
    vi.mocked(computeCycleSummaryForUser).mockResolvedValue(cycleSummaryWithClient() as any);

    await getHourPoolReport({ year: 2026, month: 7, consultantId: 1 });

    expect(computeCycleSummaryForUser).toHaveBeenCalledTimes(1);
    expect(computeCycleSummaryForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }));
  });
});
