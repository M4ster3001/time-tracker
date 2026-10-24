import type { NextFunction, Request, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { ValidationError } from '../../errors/app-error.js';

const mapZodError = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));

export const validateZod = (source: 'body' | 'query' | 'params', schema: ZodTypeAny) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new ValidationError('Validation failed', mapZodError(result.error)));
      return;
    }
    req[source] = result.data;
    next();
  };
};
