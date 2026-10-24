import { beforeEach, describe, expect, it, vi } from 'vitest';

const getManagedConsultantIdsMock = vi.hoisted(() => vi.fn());
const getDailyEntriesMock = vi.hoisted(() => vi.fn());
const findConsultantsByIdsMock = vi.hoisted(() => vi.fn());
const findClientsByIdsMock = vi.hoisted(() => vi.fn());
const computeCycleSummaryForUserMock = vi.hoisted(() => vi.fn());
const computeCycleSummariesForUsersMock = vi.hoisted(() => vi.fn());

vi.mock('../../historical-access/application/historical-access.service.js', () => ({
  getManagedConsultantIds: getManagedConsultantIdsMock,
}));

vi.mock('../infrastructure/dashboard.repository.js', () => ({
  dashboardRepository: {
    getDailyEntries: getDailyEntriesMock,
    findConsultantsByIds: findConsultantsByIdsMock,
    findClientsByIds: findClientsByIdsMock,
    getUserMonthEntries: vi.fn(),
    countConsultants: vi.fn(),
    getEntriesForRange: vi.fn(),
    getActiveConsultants: vi.fn(),
    findUsersByIds: vi.fn(),
  },
  formatDateKeyUTC: (value: Date) =>
    `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(
      value.getUTCDate()
    ).padStart(2, '0')}`,
  resolveDashboardRange: (year: number, month: number) => ({
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  }),
}));

vi.mock('../../closing-cycle/application/closing-cycle.service.js', () => ({
  computeCycleSummaryForUser: computeCycleSummaryForUserMock,
  computeCycleSummariesForUsers: computeCycleSummariesForUsersMock,
}));

import { getManagerDashboard } from './dashboard.use-cases.js';

const emptyCycle = () => ({
  byClient: [] as Array<{
    clientId: number;
    clientName: string;
    closedCycle: {
      workedMinutes: number;
      targetMinutes: number;
      normalMinutes: number;
      overtimeMinutes: number;
    };
  }>,
  totals: {
    closedCycle: {
      workedMinutes: 120,
      targetMinutes: 480,
      normalMinutes: 120,
      overtimeMinutes: 0,
    },
    nextCyclePreview: {
      workedMinutes: 0,
      targetMinutes: 0,
      normalMinutes: 0,
      overtimeMinutes: 0,
    },
  },
});

describe('getManagerDashboard batching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getManagedConsultantIdsMock.mockResolvedValue([10, 20, 30]);
    findConsultantsByIdsMock.mockResolvedValue([
      { id: 10, name: 'A' },
      { id: 20, name: 'B' },
      { id: 30, name: 'C' },
    ]);
    getDailyEntriesMock.mockResolvedValue([]);
    findClientsByIdsMock.mockResolvedValue([]);
    computeCycleSummariesForUsersMock.mockImplementation(
      async ({ userIds }: { userIds: number[] }) => {
        const map = new Map();
        userIds.forEach((userId) => {
          map.set(userId, {
            ...emptyCycle(),
            byClient: [
              {
                clientId: userId,
                clientName: `Client ${userId}`,
                closedCycle: {
                  workedMinutes: 60,
                  targetMinutes: 480,
                  normalMinutes: 60,
                  overtimeMinutes: 0,
                },
              },
            ],
          });
        });
        return map;
      }
    );
  });

  it('fetches daily entries once for all managed consultants', async () => {
    const result = await getManagerDashboard(1, 2024, 1);

    expect(getDailyEntriesMock).toHaveBeenCalledTimes(1);
    expect(getDailyEntriesMock).toHaveBeenCalledWith(
      [10, 20, 30],
      expect.any(Date),
      expect.any(Date),
      undefined
    );
    expect(result.consultants).toHaveLength(3);
  });

  it('loads cycle summaries once for all managed consultants', async () => {
    await getManagerDashboard(1, 2024, 1);

    expect(computeCycleSummariesForUsersMock).toHaveBeenCalledTimes(1);
    expect(computeCycleSummariesForUsersMock).toHaveBeenCalledWith({
      userIds: [10, 20, 30],
      year: 2024,
      month: 1,
      clientId: undefined,
    });
    expect(computeCycleSummaryForUserMock).not.toHaveBeenCalled();
  });

  it('loads cycle client metadata in one findClientsByIds call', async () => {
    await getManagerDashboard(1, 2024, 1);

    expect(findClientsByIdsMock).toHaveBeenCalledTimes(1);
    const ids = findClientsByIdsMock.mock.calls[0][0] as number[];
    expect(ids.sort()).toEqual([10, 20, 30]);
  });

  it('filters consultants by client using batched cycle summaries', async () => {
    findClientsByIdsMock.mockResolvedValue([{ id: 99, name: 'Cliente X', paysOvertime: true }]);
    computeCycleSummariesForUsersMock.mockResolvedValue(
      new Map([
        [
          10,
          {
            ...emptyCycle(),
            byClient: [
              {
                clientId: 99,
                clientName: 'Cliente X',
                closedCycle: {
                  workedMinutes: 0,
                  targetMinutes: 2400,
                  normalMinutes: 0,
                  overtimeMinutes: 0,
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
        [20, emptyCycle()],
        [30, emptyCycle()],
      ])
    );

    const result = await getManagerDashboard(1, 2024, 1, undefined, 99);

    expect(computeCycleSummariesForUsersMock).toHaveBeenCalledWith({
      userIds: [10, 20, 30],
      year: 2024,
      month: 1,
      clientId: 99,
    });
    expect(result.consultants).toHaveLength(1);
    expect(result.consultants[0].id).toBe(10);
    expect(result.consultants[0].byClient[0].clientId).toBe(99);
  });
});
