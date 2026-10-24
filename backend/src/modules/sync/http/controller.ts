import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../../app/http/presenters/api.presenter.js';
import { UnauthorizedError } from '../../../app/errors/app-error.js';
import * as syncService from '../application/sync.service.js';

export const pullController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    sendSuccess(res, 200, await syncService.pull(req.user.userId, req.user.roleId, since, req.accessGrants));
  } catch (error) {
    next(error);
  }
};

export const pushController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const { timeEntries } = req.body as { timeEntries: syncService.SyncTimeEntryDTO[] };
    sendSuccess(res, 200, await syncService.push(req.user.userId, req.user.roleId, timeEntries));
  } catch (error) {
    next(error);
  }
};
