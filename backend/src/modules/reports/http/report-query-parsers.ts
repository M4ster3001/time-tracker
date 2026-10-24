import { ValidationError } from '../../../app/errors/app-error.js';
import { parseDateOnly } from '../../../shared/domain/date.js';
import {
  clientCapacityQuerySchema,
  consultantPerformanceQuerySchema,
  type ClientCapacityQuery,
  type ConsultantPerformanceQuery,
} from './schemas.js';

const parseDateRange = (startDate: string, endDate: string) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end) {
    throw new ValidationError('Validation failed', [
      ...(start ? [] : [{ field: 'startDate', message: 'Invalid date format' }]),
      ...(end ? [] : [{ field: 'endDate', message: 'Invalid date format' }]),
    ]);
  }

  if (start > end) {
    throw new ValidationError('Validation failed', [
      { field: 'startDate', message: 'startDate must be before or equal to endDate' },
      { field: 'endDate', message: 'endDate must be after or equal to startDate' },
    ]);
  }

  return { startDate: start, endDate: end };
};

const parseIncludeInactive = (value: 'true' | 'false' | undefined): boolean => value === 'true';

const parseWithSchema = <T extends { startDate: string; endDate: string }>(
  schema: typeof consultantPerformanceQuerySchema | typeof clientCapacityQuerySchema,
  query: unknown
): T => {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new ValidationError(
      'Validation failed',
      result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      }))
    );
  }

  return result.data as T;
};

export const parseConsultantPerformanceQuery = (query: unknown) => {
  const parsed = parseWithSchema<ConsultantPerformanceQuery>(
    consultantPerformanceQuerySchema,
    query
  );
  const range = parseDateRange(parsed.startDate, parsed.endDate);

  return {
    userId: parsed.userId,
    managerId: parsed.managerId,
    clientId: parsed.clientId,
    includeInactive: parseIncludeInactive(parsed.includeInactive),
    ...range,
  };
};

export const parseClientCapacityQuery = (query: unknown) => {
  const parsed = parseWithSchema<ClientCapacityQuery>(clientCapacityQuerySchema, query);
  const range = parseDateRange(parsed.startDate, parsed.endDate);

  return {
    clientId: parsed.clientId,
    includeInactive: parseIncludeInactive(parsed.includeInactive),
    ...range,
  };
};
