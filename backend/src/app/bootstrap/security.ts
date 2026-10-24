import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import { config } from '../../config.js';
import { isAllowedBrowserOrigin } from '../../shared/infrastructure/http/allowed-origin.js';
import { auditMiddleware } from '../http/middleware/audit.middleware.js';
import { csrfOriginMiddleware } from '../http/middleware/csrf.middleware.js';
import { sanitizeBody } from '../http/middleware/validation.middleware.js';
import { requestContextMiddleware } from '../http/middleware/request-context.middleware.js';
import {
  resolveLoginRateLimitMax,
  resolveRefreshRateLimitMax,
} from './auth-rate-limit-policy.js';
import { resolveHelmetOptions } from './helmet-csp-policy.js';


/** Local/test QA remounts burn login+refresh quickly; staging/production stay tight. */
const loginMax = resolveLoginRateLimitMax(config.env, config.rateLimit.maxRequests);
const refreshMax = resolveRefreshRateLimitMax(config.env);

export const loginLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: loginMax,
  message: 'Too many login attempts, please try again later',
});

export const refreshLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: refreshMax,
  message: 'Too many refresh attempts, please try again later',
});

export const revokeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 10,
  message: 'Too many revoke attempts, please try again later',
});

export const adminWriteLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 50,
  message: 'Too many admin operations, please try again later',
});

export const adminReadLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 100,
  message: 'Too many admin read requests, please try again later',
});

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 200,
  message: 'Too many requests, please try again later',
});

export const aiLimiter = rateLimit({
  windowMs: config.ai.rateLimit.windowMs,
  max: config.ai.rateLimit.maxRequests,
  message: 'Too many AI requests, please try again later',
});

export const applySecurityMiddleware = (app: Express): void => {
  const corsOrigin = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ): void => {
    if (
      !origin ||
      isAllowedBrowserOrigin(origin, {
        allowlist: config.cors.origins,
        allowPrivateLan: config.cors.allowPrivateLan,
      })
    ) {
      callback(null, true);
      return;
    }

    callback(null, false);
  };

  app.set('trust proxy', 1);
  app.use(...(requestContextMiddleware as RequestHandler[]));
  app.use(helmet(resolveHelmetOptions({ desktopMode: config.desktopMode })) as RequestHandler);
  app.use(compression() as RequestHandler);
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );
  app.use(hpp() as RequestHandler);
  app.use(express.json({ limit: '10kb' }) as RequestHandler);
  app.use(cookieParser());
  app.use(auditMiddleware);
  app.use('/api', csrfOriginMiddleware);
  app.use('/api', sanitizeBody);
};
