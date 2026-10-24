import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  consultantDashboardController,
  managerDashboardController,
} from './dashboard.controller.js';
import * as dashboardService from '../modules/dashboards/application/dashboard.use-cases.js';

vi.mock('../modules/dashboards/application/dashboard.use-cases.js', () => ({
  getConsultantDashboard: vi.fn(),
  getManagerDashboard: vi.fn(),
}));

const createRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('DashboardController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('consultantDashboardController deve retornar dashboard do consultor', async () => {
    const req = {
      query: { month: '1', year: '2024' },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;

    const res = createRes();

    vi.mocked(dashboardService.getConsultantDashboard).mockResolvedValueOnce({
      totalHours: 10,
      totalMinutes: 600,
      targetHours: 160,
      targetMinutes: 9600,
      progressPercent: 6.25,
      byClient: [],
      daily: [],
      overtimeMinutes: 0,
      overtimeByClient: [],
      cycleSummary: {
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
      entries: [],
    });

    await consultantDashboardController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('managerDashboardController deve retornar dashboard do manager', async () => {
    const req = {
      query: { month: '1', year: '2024' },
      user: { userId: 1, roleId: 2, email: 'test-user-2@example.test' },
    } as unknown as Request;

    const res = createRes();

    vi.mocked(dashboardService.getManagerDashboard).mockResolvedValueOnce({
      consultants: [],
    });

    await managerDashboardController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
