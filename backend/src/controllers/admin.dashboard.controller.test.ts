import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { adminDashboardController } from './admin.dashboard.controller.js';
import * as adminDashboardService from '../modules/dashboards/application/dashboard.use-cases.js';

vi.mock('../modules/dashboards/application/dashboard.use-cases.js', () => ({
  getAdminDashboard: vi.fn(),
}));

const createRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('AdminDashboardController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('deve retornar dashboard admin', async () => {
    const req = { query: { month: '1', year: '2024' } } as unknown as Request;
    const res = createRes();

    vi.mocked(adminDashboardService.getAdminDashboard).mockResolvedValueOnce({
      totalConsultants: 1,
      totalHours: 10,
      totalMinutes: 600,
      targetHours: 160,
      targetMinutes: 9600,
      progressPercent: 6.25,
      overtimeMinutes: 0,
      overtimeByClient: [],
      overtimeByConsultant: [],
      cycleSummary: {
        consultants: [],
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
      topClients: [],
      topConsultants: [],
      daily: [],
    });

    await adminDashboardController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
