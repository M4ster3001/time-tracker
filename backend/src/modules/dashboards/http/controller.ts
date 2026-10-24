import type { Request, Response } from 'express';
import {
  getConsultantDashboard,
  getManagerDashboard,
  getAdminDashboard,
} from '../application/dashboard.use-cases.js';
import type { IApiResponse } from '../../../shared/domain/api-response.types.js';
import { resolveErrorStatus, getErrorMessage } from '../../../app/errors/app-error.js';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../../shared/infrastructure/cache/cache.service.js';
import { config } from '../../../config.js';

const parseMonthYear = (req: Request): { month: number; year: number } => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  if (!month || !year || Number.isNaN(month) || Number.isNaN(year)) {
    throw new Error('Month and year are required');
  }
  return { month, year };
};

const parseOptionalNumber = (value: unknown, label: string): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error(`Invalid ${label}`);
  return parsed;
};

export const consultantDashboardController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const { month, year } = parseMonthYear(req);
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

    if (!startDate && !endDate) {
      const cacheKey = `${CACHE_KEYS.DASHBOARD_CONSULTANT}${req.user.userId}:${year}:${month}`;
      const cached = await cacheGet(cacheKey);
      if (cached) {
        res
          .status(200)
          .json({ success: true, data: cached, fromCache: true } as IApiResponse<typeof cached>);
        return;
      }

      const dashboard = await getConsultantDashboard(req.user.userId, year, month);
      await cacheSet(cacheKey, dashboard, config.redis.cacheTtl.dashboard);
      res.status(200).json({ success: true, data: dashboard } as IApiResponse<typeof dashboard>);
      return;
    }

    const dashboard = await getConsultantDashboard(
      req.user.userId,
      year,
      month,
      startDate,
      endDate
    );
    res.status(200).json({ success: true, data: dashboard } as IApiResponse<typeof dashboard>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const managerDashboardController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const { month, year } = parseMonthYear(req);
    const consultantId = req.query.consultantId
      ? parseOptionalNumber(req.query.consultantId, 'consultantId')
      : undefined;
    const clientId = req.query.clientId
      ? parseOptionalNumber(req.query.clientId, 'clientId')
      : undefined;
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

    if (!startDate && !endDate) {
      const cacheKey = `${CACHE_KEYS.DASHBOARD_MANAGER}${req.user.userId}:${year}:${month}:${consultantId ?? 'all'}:${clientId ?? 'all'}`;
      const cached = await cacheGet(cacheKey);
      if (cached) {
        res
          .status(200)
          .json({ success: true, data: cached, fromCache: true } as IApiResponse<typeof cached>);
        return;
      }

      const dashboard = await getManagerDashboard(
        req.user.userId,
        year,
        month,
        consultantId,
        clientId
      );
      await cacheSet(cacheKey, dashboard, config.redis.cacheTtl.dashboard);
      res.status(200).json({ success: true, data: dashboard } as IApiResponse<typeof dashboard>);
      return;
    }

    const dashboard = await getManagerDashboard(
      req.user.userId,
      year,
      month,
      consultantId,
      clientId,
      startDate,
      endDate
    );
    res.status(200).json({ success: true, data: dashboard } as IApiResponse<typeof dashboard>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const adminDashboardController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = parseMonthYear(req);
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

    if (!startDate && !endDate) {
      const cacheKey = `${CACHE_KEYS.DASHBOARD_ADMIN}:${year}:${month}`;
      const cached = await cacheGet(cacheKey);
      if (cached) {
        res
          .status(200)
          .json({ success: true, data: cached, fromCache: true } as IApiResponse<typeof cached>);
        return;
      }

      const dashboard = await getAdminDashboard(year, month);
      await cacheSet(cacheKey, dashboard, config.redis.cacheTtl.dashboard);
      res.status(200).json({ success: true, data: dashboard } as IApiResponse<typeof dashboard>);
      return;
    }

    const dashboard = await getAdminDashboard(year, month, startDate, endDate);
    res.status(200).json({ success: true, data: dashboard } as IApiResponse<typeof dashboard>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};
