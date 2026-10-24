import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../errors/app-error.js';
import { errorHandlerMiddleware } from './error-handler.middleware.js';
import { validate, validateZod } from './validation.middleware.js';

describe('validation middleware', () => {
  it('returns fieldErrors when legacy validation fails', () => {
    const middleware = validate('body', {
      durationMinutes: { type: 'number', required: true, max: 1440 },
    });

    const req = {
      body: { durationMinutes: 2000 },
      headers: {},
    } as Request;

    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const setHeader = vi.fn();
    const res = {
      locals: { requestId: 'req-123' },
      status,
      json,
      setHeader,
    } as unknown as Response;
    const next = vi.fn((error?: unknown) => {
      if (error) {
        errorHandlerMiddleware(error, req, res, vi.fn() as unknown as NextFunction);
      }
    }) as unknown as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        requestId: 'req-123',
        details: {
          code: 'VALIDATION_ERROR',
          requestId: 'req-123',
          fields: [
            {
              field: 'durationMinutes',
              message: 'duration Minutes must be at most 1440',
            },
          ],
          fieldErrors: [
            {
              field: 'durationMinutes',
              message: 'duration Minutes must be at most 1440',
            },
          ],
        },
      })
    );
  });

  it('accepts human-readable duration strings for durationMinutes', () => {
    const middleware = validate('body', {
      durationMinutes: { type: 'number', required: true, min: 15, max: 480 },
    });

    const req = {
      body: { durationMinutes: '1h 30m' },
      headers: {},
    } as Request;

    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const setHeader = vi.fn();
    const res = {
      locals: { requestId: 'req-456' },
      status,
      json,
      setHeader,
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('supports direct zod validation helpers', () => {
    const middleware = validateZod(
      'body',
      z.object({
        enabled: z.preprocess((value) => value === 'true', z.boolean()),
        snoozeMinutes: z.coerce.number().int().min(5),
      })
    );

    const req = {
      body: { enabled: 'true', snoozeMinutes: '30' },
    } as Request;

    const res = {} as Response;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('propagates requestId and fieldErrors through the shared error handler', () => {
    const error = new ValidationError('Validation failed', [
      { field: 'snoozeMinutes', message: 'snoozeMinutes must be a valid number' },
    ]);

    const req = { method: 'PUT', path: '/api/notifications/preferences' } as Request;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const setHeader = vi.fn();
    const res = {
      locals: { requestId: 'req-789' },
      status,
      json,
      setHeader,
    } as unknown as Response;

    errorHandlerMiddleware(error, req, res, vi.fn() as unknown as NextFunction);

    expect(setHeader).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        requestId: 'req-789',
        details: {
          code: 'VALIDATION_ERROR',
          requestId: 'req-789',
          fields: [
            {
              field: 'snoozeMinutes',
              message: 'snoozeMinutes must be a valid number',
            },
          ],
          fieldErrors: [
            {
              field: 'snoozeMinutes',
              message: 'snoozeMinutes must be a valid number',
            },
          ],
        },
      })
    );
  });
});
