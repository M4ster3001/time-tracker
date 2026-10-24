import type { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { isDesktopRuntime } from '../../../shared/infrastructure/runtime/app-runtime.js';

const AUDIT_ENDPOINTS = [
  '/api/users',
  '/api/clients',
  '/api/time-entries',
  '/api/user-clients',
  '/api/export',
  '/api/manager/consultants',
];

/**
 * Middleware to log audit events
 */
export const auditMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const originalSend = res.send;

  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => {
        if (
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret')
        ) {
          return [key, '[REDACTED]'];
        }
        return [key, redact(val)];
      });
      return Object.fromEntries(entries);
    }
    return value;
  };

  const toJsonValue = (value: unknown): Prisma.InputJsonValue => {
    try {
      return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    } catch {
      return {};
    }
  };

  const buildResponseSummary = (payload: unknown): Record<string, unknown> => {
    let parsed: unknown = payload;
    if (typeof payload === 'string') {
      try {
        parsed = JSON.parse(payload);
      } catch {
        parsed = payload.slice(0, 500);
      }
    }
    if (Buffer.isBuffer(payload)) {
      const text = payload.toString('utf-8');
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text.slice(0, 500);
      }
    }
    if (parsed && typeof parsed === 'object') {
      const asObj = parsed as Record<string, unknown>;
      return {
        success: typeof asObj.success === 'boolean' ? asObj.success : undefined,
        error: typeof asObj.error === 'string' ? asObj.error : undefined,
        message: typeof asObj.message === 'string' ? asObj.message : undefined,
      };
    }
    return {
      preview: typeof parsed === 'string' ? parsed.slice(0, 200) : parsed,
    };
  };

  res.send = function (data: unknown) {
    // Check if this endpoint should be audited
    const shouldAudit = AUDIT_ENDPOINTS.some((endpoint) => req.path.startsWith(endpoint));

    if (shouldAudit) {
      const statusCode = res.statusCode;
      const status = statusCode >= 200 && statusCode < 300 ? 'success' : 'failure';

      // Log audit event asynchronously
      const responseSummary = toJsonValue(buildResponseSummary(data));
      const detailsPayload: Prisma.InputJsonObject = {
        statusCode,
        method: req.method,
        path: req.path,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') || null,
        params: toJsonValue(redact(req.params)),
        query: toJsonValue(redact(req.query)),
        body: toJsonValue(redact(req.body)),
        responseSummary,
      };
      const details = JSON.stringify(detailsPayload).slice(0, 4000);
      const detailsJsonData = isDesktopRuntime()
        ? (JSON.stringify(detailsPayload) as unknown as Prisma.InputJsonObject)
        : detailsPayload;

      prisma.auditLog
        .create({
          data: {
            userId: req.user?.userId || null,
            endpoint: req.path,
            action: `${req.method} ${req.path}`,
            status,
            details,
            detailsJson: detailsJsonData,
            ip: req.ip,
            userAgent: req.get('user-agent') || null,
          },
        })
        .catch((error) => {
          logger.error({ err: error }, 'Failed to log audit event');
        });
    }

    return originalSend.call(this, data);
  };

  next();
};
