import type { Response } from 'express';
import type { AppError } from '../../errors/app-error.js';

export const sendSuccess = <T>(res: Response, statusCode: number, data?: T, message?: string) => {
  return res.status(statusCode).json({ success: true, data, message });
};

export const sendError = (res: Response, error: AppError) => {
  const requestId = res.locals?.requestId;
  return res.status(error.statusCode).json({
    success: false,
    error: error.message,
    code: error.code,
    requestId,
    details: {
      code: error.code,
      fields: error.fieldErrors,
      fieldErrors: error.fieldErrors,
      requestId,
    },
  });
};
