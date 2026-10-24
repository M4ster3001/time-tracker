import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { withLocale } from '../../../shared/domain/locale.js';

const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const requestId = typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
    res.setHeader('x-request-id', requestId);
    return requestId;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req(req) {
      return { method: req.method, url: req.url, userId: req.user?.userId };
    },
  },
});

export const requestContextMiddleware = [
  httpLogger,
  (req: Request, res: Response, next: NextFunction) => {
    const requestId = String(req.id);
    req.requestId = requestId;
    res.locals.requestId = requestId;
    withLocale(req.get('accept-language'), next);
  },
];
