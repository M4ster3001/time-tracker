import { beforeEach, describe, expect, it, vi } from 'vitest';
const prismaMock = vi.hoisted(() => ({
  $use: vi.fn(),
  user: { findMany: vi.fn() },
  userClient: { findMany: vi.fn() },
  timeEntry: { findMany: vi.fn() },
  clientAllocation: { findMany: vi.fn() },
  client: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

const computeCycleSummaryForUserMock = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      byClient: [],
      totals: {
        closedCycle: { workedMinutes: 0, targetMinutes: 0, normalMinutes: 0, overtimeMinutes: 0 },
        nextCyclePreview: {
          workedMinutes: 0,
          targetMinutes: 0,
          normalMinutes: 0,
          overtimeMinutes: 0,
        },
      },
    })
  )
);

vi.mock('../modules/closing-cycle/application/closing-cycle.service.js', () => ({
  computeCycleSummaryForUser: computeCycleSummaryForUserMock,
}));

vi.mock('@prisma/client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@prisma/client')>(),
  PrismaClient: vi.fn(function () { return prismaMock; }),
  AllocationType: { DAILY: 'DAILY', MONTHLY: 'MONTHLY' },
}));

let getClientCapacityReport: typeof import('./admin-report.service.js').getClientCapacityReport;
let getConsultantPerformanceReport: typeof import('./admin-report.service.js').getConsultantPerformanceReport;

beforeEach(async () => {
  ({ getClientCapacityReport, getConsultantPerformanceReport } =
    await import('./admin-report.service.js'));
});

describe('admin-report.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prismaMock.userClient.findMany).mockResolvedValue([]);
    vi.mocked(prismaMock.$queryRaw).mockResolvedValue([]);
  });

  it('mantem consultor historico com horas sem alocacao e uso N/A', async () => {
    vi.mocked(prismaMock.user.findMany).mockResolvedValueOnce([]);
    vi.mocked(prismaMock.timeEntry.findMany).mockResolvedValueOnce([
      {
        userId: 10,
        clientId: 20,
        date: new Date('2026-02-10'),
        durationMinutes: 480,
        user: {
          id: 10,
          roleId: 3,
          name: 'Aldo',
          email: 'test-user-1@example.test',
          managerId: 2,
          isActive: false,
          deletedAt: null,
          manager: { id: 2, name: 'Manager' },
        },
        client: {
          id: 20,
          name: 'HOR',
          code: 'HOR',
          isActive: true,
          deletedAt: null,
        },
      },
    ] as any);
    vi.mocked(prismaMock.clientAllocation.findMany).mockResolvedValueOnce([]);

    const report = await getConsultantPerformanceReport({
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-28'),
    });

    expect(report).toHaveLength(1);
    expect(report[0].userName).toBe('Aldo');
    expect(report[0].workedHours).toBe(8);
    expect(report[0].allocatedHours).toBe(0);
    expect(report[0].utilizationPercent).toBeNull();
    expect(report[0].clientBreakdown[0].utilizationPercent).toBeNull();
  });

  it('mantem cliente historico inativo com horas no periodo', async () => {
    vi.mocked(prismaMock.client.findMany).mockResolvedValueOnce([]);
    vi.mocked(prismaMock.timeEntry.findMany).mockResolvedValueOnce([
      {
        userId: 15,
        clientId: 30,
        durationMinutes: 240,
        user: { id: 15, name: 'Consultor X', roleId: 3, deletedAt: null },
        client: {
          id: 30,
          name: 'Martins',
          code: 'MRT',
          isActive: false,
          deletedAt: null,
        },
      },
    ] as any);
    vi.mocked(prismaMock.clientAllocation.findMany).mockResolvedValueOnce([]);

    const report = await getClientCapacityReport({
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-28'),
      includeInactive: false,
    });

    expect(report).toHaveLength(1);
    expect(report[0].clientName).toBe('Martins');
    expect(report[0].totalWorkedHours).toBe(4);
    expect(report[0].totalAllocatedHours).toBe(0);
    expect(report[0].utilizationPercent).toBeNull();
    expect(report[0].consultantBreakdown[0].utilizationPercent).toBeNull();
  });

  it('mantem calculo percentual normal quando existe alocacao', async () => {
    vi.mocked(prismaMock.user.findMany).mockResolvedValueOnce([
      {
        id: 9,
        roleId: 3,
        name: 'Consultor Y',
        email: 'test-user-2@example.test',
        managerId: 2,
        isActive: true,
        deletedAt: null,
        manager: { id: 2, name: 'Manager' },
      },
    ] as any);
    vi.mocked(prismaMock.timeEntry.findMany).mockResolvedValueOnce([
      {
        userId: 9,
        clientId: 99,
        date: new Date(2026, 1, 2),
        durationMinutes: 480,
        user: {
          id: 9,
          roleId: 3,
          name: 'Consultor Y',
          email: 'test-user-2@example.test',
          managerId: 2,
          isActive: true,
          deletedAt: null,
          manager: { id: 2, name: 'Manager' },
        },
        client: {
          id: 99,
          name: 'Cliente Z',
          code: 'CLZ',
          isActive: true,
          deletedAt: null,
        },
      },
    ] as any);
    vi.mocked(prismaMock.clientAllocation.findMany).mockResolvedValueOnce([
      {
        userId: 9,
        clientId: 99,
        allocationType: 'DAILY',
        hoursPerDay: 8,
        hoursPerMonth: null,
        user: {
          id: 9,
          roleId: 3,
          name: 'Consultor Y',
          email: 'test-user-2@example.test',
          managerId: 2,
          isActive: true,
          deletedAt: null,
          manager: { id: 2, name: 'Manager' },
        },
        client: {
          id: 99,
          name: 'Cliente Z',
          code: 'CLZ',
          isActive: true,
          deletedAt: null,
        },
      },
    ] as any);

    const report = await getConsultantPerformanceReport({
      startDate: new Date(2026, 1, 2),
      endDate: new Date(2026, 1, 2),
    });

    expect(report).toHaveLength(1);
    expect(report[0].allocatedHours).toBe(8);
    expect(report[0].workedHours).toBe(8);
    expect(report[0].utilizationPercent).toBe(100);
  });
});
