/**
 * SEC-07: Server-side validation middleware
 * Provides consistent validation patterns for all API routes
 */

import { Request, Response, NextFunction } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { ValidationError, type FieldError } from '../../errors/app-error.js';
import { parseDurationMinutes } from '../../../shared/domain/duration.js';
import type { ValidationRule } from '../../../shared/domain/validation/validation.contracts.js';
import type { ValidationSchema, ValidationSource } from './validation.types.js';

// ============================================================================
// Zod helpers
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizeFieldName = (fieldName: string): string =>
  fieldName.replace(/([a-z])([A-Z])/g, '$1 $2');

const fieldLabel = (fieldName: string): string => normalizeFieldName(fieldName);

const numberFromUnknown = (value: unknown, fieldName: string): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (fieldName === 'durationMinutes') {
    return parseDurationMinutes(trimmed);
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const booleanFromUnknown = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return null;
};

const legacyRuleToZod = (fieldName: string, rule: ValidationRule): ZodTypeAny => {
  const label = fieldLabel(fieldName);
  switch (rule.type) {
    case 'string': {
      let schema = z.string({ error: rule.message || `${label} is required` });
      if (rule.min !== undefined) {
        schema = schema.min(rule.min, `${label} must be at least ${rule.min} characters`);
      }
      if (rule.max !== undefined) {
        schema = schema.max(rule.max, `${label} must be at most ${rule.max} characters`);
      }
      if (rule.pattern) {
        schema = schema.regex(rule.pattern, rule.message || `${label} has invalid format`);
      }
      return rule.required ? schema : schema.optional();
    }

    case 'number': {
      let schema = z.preprocess(
        (value) => numberFromUnknown(value, fieldName),
        z.number({ error: rule.message || `${label} is required` })
      );
      if (rule.min !== undefined) {
        schema = schema.refine(
          (value) => typeof value === 'number' && value >= rule.min!,
          `${label} must be at least ${rule.min}`
        );
      }
      if (rule.max !== undefined) {
        schema = schema.refine(
          (value) => typeof value === 'number' && value <= rule.max!,
          `${label} must be at most ${rule.max}`
        );
      }
      return rule.required ? schema : schema.optional();
    }

    case 'boolean': {
      const schema = z.preprocess(
        booleanFromUnknown,
        z.boolean({ error: rule.message || `${label} is required` })
      );
      return rule.required ? schema : schema.optional();
    }

    case 'email': {
      const schema = z
        .string({ error: rule.message || `${label} is required` })
        .regex(EMAIL_REGEX, {
          message: `${label} must be a valid email address`,
        });
      return rule.required ? schema : schema.optional();
    }

    case 'date': {
      const schema = z
        .string({ error: rule.message || `${label} is required` })
        .regex(DATE_REGEX, { message: `${label} must be a valid date (YYYY-MM-DD)` })
        .refine(
          (value) => !Number.isNaN(new Date(value).getTime()),
          `${label} must be a valid date`
        );
      return rule.required ? schema : schema.optional();
    }

    case 'array': {
      let schema = z.array(z.unknown(), { error: rule.message || `${label} is required` });
      if (rule.min !== undefined) {
        schema = schema.min(rule.min, `${label} must have at least ${rule.min} items`);
      }
      if (rule.max !== undefined) {
        schema = schema.max(rule.max, `${label} must have at most ${rule.max} items`);
      }
      return rule.required ? schema : schema.optional();
    }
  }
};

const legacySchemaToZod = (schema: ValidationSchema): ZodTypeAny => {
  const shape: Record<string, ZodTypeAny> = {};
  for (const [fieldName, rule] of Object.entries(schema)) {
    shape[fieldName] = legacyRuleToZod(fieldName, rule);
  }
  return z.object(shape).passthrough();
};

const mapZodIssues = (issues: z.ZodIssue[]): FieldError[] =>
  issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));

// ============================================================================
// Middleware Factory
// ============================================================================

export const validateZod = (source: ValidationSource, schema: ZodTypeAny) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new ValidationError('Validation failed', mapZodIssues(result.error.issues)));
      return;
    }

    req[source] = result.data as never;
    next();
  };
};

/**
 * Creates a validation middleware for the specified source and schema.
 * Legacy schema support is preserved, but validation is executed via Zod.
 */
export const validate = (source: ValidationSource, schema: ValidationSchema) => {
  return validateZod(source, legacySchemaToZod(schema));
};

// ============================================================================
// Common Validation Schemas (reusable across routes)
// ============================================================================

export const schemas = {
  // Auth schemas
  login: {
    email: { type: 'email' as const, required: true },
    password: { type: 'string' as const, required: true, min: 1 },
  },

  register: {
    name: { type: 'string' as const, required: true, min: 2, max: 100 },
    email: { type: 'email' as const, required: true },
    password: { type: 'string' as const, required: true, min: 12, max: 128 },
  },

  // User schemas
  createUser: {
    name: { type: 'string' as const, required: true, min: 2, max: 100 },
    email: { type: 'email' as const, required: true },
    password: { type: 'string' as const, required: true, min: 12, max: 128 },
    roleId: { type: 'number' as const, required: true, min: 1, max: 3 },
  },

  updateUser: {
    name: { type: 'string' as const, min: 2, max: 100 },
    email: { type: 'email' as const },
    roleId: { type: 'number' as const, min: 1, max: 3 },
    managerId: { type: 'number' as const, min: 1 },
  },

  // Time Entry schemas
  createTimeEntry: {
    clientId: { type: 'number' as const, required: true, min: 1 },
    date: { type: 'date' as const, required: true },
    activityDescription: { type: 'string' as const, required: true, min: 1, max: 5000 },
    durationMinutes: { type: 'number' as const, required: true, min: 15, max: 480 },
  },

  updateTimeEntry: {
    clientId: { type: 'number' as const, min: 1 },
    date: { type: 'date' as const },
    activityDescription: { type: 'string' as const, min: 1, max: 5000 },
    durationMinutes: { type: 'number' as const, min: 15, max: 480 },
  },

  bulkTimeEntries: {
    entries: { type: 'array' as const, required: true, min: 1, max: 100 },
  },

  createClient: {
    name: { type: 'string' as const, required: true, min: 2, max: 100 },
    code: { type: 'string' as const, required: true, min: 1, max: 20 },
    lockDay: { type: 'number' as const, min: 1, max: 28 },
  },

  updateClient: {
    name: { type: 'string' as const, min: 2, max: 100 },
    code: { type: 'string' as const, min: 1, max: 20 },
    lockDay: { type: 'number' as const, min: 1, max: 28 },
  },

  // Query params
  monthYear: {
    month: { type: 'number' as const, required: true, min: 1, max: 12 },
    year: { type: 'number' as const, required: true, min: 2000, max: 2100 },
  },

  pagination: {
    page: { type: 'number' as const, min: 1 },
    limit: { type: 'number' as const, min: 1, max: 100 },
  },

  // ID param
  id: {
    id: { type: 'number' as const, required: true, min: 1 },
  },
};

// ============================================================================
// Utility: Sanitize string inputs
// ============================================================================

/**
 * Sanitizes a string to prevent XSS (strips HTML tags)
 */
export const sanitizeString = (value: string): string => {
  return value.replace(/<[^>]*>/g, '').trim();
};

/**
 * Middleware to sanitize all string values in request body
 */
export const sanitizeBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }
  next();
};
