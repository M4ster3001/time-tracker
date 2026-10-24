import type { Request, Response } from 'express';
import { sendSuccess } from '../../../app/http/presenters/api.presenter.js';
import type { IApiResponse } from '../../../shared/domain/api-response.types.js';
import {
  getTemporaryUnlockDetails,
  grantTemporaryUnlock,
  listTemporaryUnlocks,
  revokeTemporaryUnlock,
} from '../application/temporary-unlock.service.js';
import {
  grantTemporaryUnlockSchema,
  temporaryUnlockIdParamSchema,
  temporaryUnlockListQuerySchema,
} from './schemas.js';

const getRequestUserId = (req: Request, res: Response): number | null => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
    return null;
  }
  return req.user.userId;
};

export const grantTemporaryUnlockController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const requestUserId = getRequestUserId(req, res);
  if (!requestUserId) return;

  const payload = grantTemporaryUnlockSchema.parse(req.body);
  const unlock = await grantTemporaryUnlock({ ...payload, grantedBy: requestUserId });
  sendSuccess(res, 201, unlock);
};

export const revokeTemporaryUnlockController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const requestUserId = getRequestUserId(req, res);
  if (!requestUserId) return;

  const { id } = temporaryUnlockIdParamSchema.parse(req.params);
  const unlock = await revokeTemporaryUnlock(id, requestUserId);
  sendSuccess(res, 200, unlock);
};

export const listTemporaryUnlocksController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const query = temporaryUnlockListQuerySchema.parse(req.query);
  const result = await listTemporaryUnlocks(query);
  res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
};

export const getTemporaryUnlockDetailsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = temporaryUnlockIdParamSchema.parse(req.params);
  const details = await getTemporaryUnlockDetails(id);
  if (!details) {
    res.status(404).json({ success: false, error: 'Not found' } as IApiResponse<null>);
    return;
  }
  sendSuccess(res, 200, details);
};
