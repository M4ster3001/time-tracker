import type { NextFunction, Request, Response } from 'express';
import { toAppError } from '../../errors/app-error.js';
import { sendError } from '../presenters/api.presenter.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';

export const errorHandlerMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const appError = toAppError(error);
  logger.error(
    {
      err: error,
      requestId: res.locals.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: appError.statusCode,
      code: appError.code,
      userId: req.user?.userId,
    },
    '[HTTP] Request failed'
  );
  sendError(res, appError);
};
