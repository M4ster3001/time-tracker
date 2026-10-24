import type { Request, Response, NextFunction } from 'express';
import { BadRequestError, UnauthorizedError } from '../../../../app/errors/app-error.js';
import { sendSuccess } from '../../../../app/http/presenters/api.presenter.js';
import { listActivityTags } from '../application/activity-tag.service.js';
import { activityTagRepository } from '../index.js';

export const listActivityTagsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');

    const limit = req.query.limit ? Number(req.query.limit) : 8;
    if (Number.isNaN(limit) || limit <= 0) {
      throw new BadRequestError('Invalid limit');
    }
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    if (clientId !== undefined && (Number.isNaN(clientId) || clientId <= 0)) {
      throw new BadRequestError('Invalid clientId');
    }

    const tags = await listActivityTags(
      req.user.userId,
      limit,
      { clientId },
      { repository: activityTagRepository }
    );
    sendSuccess(res, 200, tags);
  } catch (error) {
    next(error);
  }
};
