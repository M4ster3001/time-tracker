import type { Request, Response } from 'express';
import type { IApiResponse } from '../../../shared/domain/api-response.types.js';
import type { IClient } from '../../clients/domain/client.types.js';
import type { IUser } from '../../users/domain/user.types.js';
import { resolveErrorStatus, getErrorMessage } from '../../../app/errors/app-error.js';
import {
  listManagerClients,
  listManagedConsultants,
  updateManagerClientLockDay,
} from '../application/manager.service.js';

const parseLockDay = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const normalized = Math.round(parsed);
  if (normalized < 1 || normalized > 31) return undefined;
  return normalized;
};

export const listManagerClientsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;

    if (year !== undefined && Number.isNaN(year)) {
      res.status(400).json({ success: false, error: 'Invalid year' } as IApiResponse<null>);
      return;
    }
    if (month !== undefined && Number.isNaN(month)) {
      res.status(400).json({ success: false, error: 'Invalid month' } as IApiResponse<null>);
      return;
    }

    const clients = await listManagerClients(req.user.userId, year, month);
    res.status(200).json({ success: true, data: clients } as IApiResponse<IClient[]>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const listManagedConsultantsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    if (clientId !== undefined && Number.isNaN(clientId)) {
      res.status(400).json({ success: false, error: 'Invalid clientId' } as IApiResponse<null>);
      return;
    }
    if (year !== undefined && Number.isNaN(year)) {
      res.status(400).json({ success: false, error: 'Invalid year' } as IApiResponse<null>);
      return;
    }
    if (month !== undefined && Number.isNaN(month)) {
      res.status(400).json({ success: false, error: 'Invalid month' } as IApiResponse<null>);
      return;
    }

    const consultants = await listManagedConsultants(req.user.userId, clientId, year, month);
    res.status(200).json({ success: true, data: consultants } as IApiResponse<IUser[]>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const updateManagerClientLockDayController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    const { lockDay } = req.body;
    const parsedLockDay = parseLockDay(lockDay);
    if (parsedLockDay === undefined) {
      res.status(400).json({ success: false, error: 'Invalid lockDay' } as IApiResponse<null>);
      return;
    }

    const updated = await updateManagerClientLockDay(req.user.userId, id, parsedLockDay, {
      actorUserId: req.user.userId,
    });

    res.status(200).json({ success: true, data: updated } as IApiResponse<IClient>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};
