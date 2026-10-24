import type { Request, Response } from 'express';
import {
  grantTemporaryUnlock,
  revokeTemporaryUnlock,
  listTemporaryUnlocks,
  getTemporaryUnlockDetails,
} from '../services/temporary-unlock.service.js';
import { resolveErrorStatus, getErrorMessage } from '../app/errors/app-error.js';
import type { IApiResponse } from '../shared/domain/api-response.types.js';

export const grantTemporaryUnlockController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const { userId, clientId, periodYear, periodMonth, reason, durationHours } = req.body;

    if (!userId || !clientId || !periodYear || !periodMonth || !reason) {
      res
        .status(400)
        .json({ success: false, error: 'Missing required fields' } as IApiResponse<null>);
      return;
    }

    const unlock = await grantTemporaryUnlock({
      userId: Number(userId),
      clientId: Number(clientId),
      grantedBy: req.user.userId,
      periodYear: Number(periodYear),
      periodMonth: Number(periodMonth),
      reason: String(reason),
      durationHours: durationHours ? Number(durationHours) : undefined,
    });

    res.status(201).json({ success: true, data: unlock });
  } catch (error) {
    const message = getErrorMessage(error);
    res.status(resolveErrorStatus(error)).json({ success: false, error: message });
  }
};

export const revokeTemporaryUnlockController = async (
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

    const unlock = await revokeTemporaryUnlock(id, req.user.userId);
    res.status(200).json({ success: true, data: unlock });
  } catch (error) {
    const message = getErrorMessage(error);
    res.status(resolveErrorStatus(error)).json({ success: false, error: message });
  }
};

export const listTemporaryUnlocksController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const activeOnly = req.query.activeOnly === 'true';
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const result = await listTemporaryUnlocks({ userId, clientId, activeOnly, page, limit });
    res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    const message = getErrorMessage(error);
    res.status(resolveErrorStatus(error)).json({ success: false, error: message });
  }
};

export const getTemporaryUnlockDetailsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    const details = await getTemporaryUnlockDetails(id);
    if (!details) {
      res.status(404).json({ success: false, error: 'Not found' } as IApiResponse<null>);
      return;
    }

    res.status(200).json({ success: true, data: details });
  } catch (error) {
    const message = getErrorMessage(error);
    res.status(resolveErrorStatus(error)).json({ success: false, error: message });
  }
};
