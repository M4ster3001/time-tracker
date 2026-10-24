import { describe, expect, it } from 'vitest';
import {
  buildFriendlyApiErrorMessage,
  extractApiError,
  extractApiValidationErrors,
  parseDurationToMinutes,
} from './formatters';

describe('extractApiError', () => {
  it('translates backend future-date validation error', () => {
    const error = {
      response: {
        data: {
          error: 'Cannot create time entry for future dates',
        },
      },
    };

    expect(extractApiError(error, 'Falha')).toContain(
      'Não é permitido lançar horas em datas futuras.'
    );
    expect(extractApiError(error, 'Falha')).toContain(
      'Se o problema continuar, contate seu supervisor (manager) ou um administrador.'
    );
  });

  it('returns fallback for unknown non-error payload', () => {
    expect(extractApiError(null, 'Falha ao salvar')).toBe('Falha ao salvar');
  });

  it('adds support hint for 500 errors', () => {
    const message = buildFriendlyApiErrorMessage('Internal server error', 500);
    expect(message).toContain('erro interno');
    expect(message).toContain('supervisor');
  });

  it('extracts field-level validation errors', () => {
    const error = {
      response: {
        data: {
          details: {
            fields: [{ field: 'durationMinutes', message: 'durationMinutes must be at most 1440' }],
          },
        },
      },
    };
    const fields = extractApiValidationErrors(error);
    expect(fields.durationMinutes).toBe('durationMinutes must be at most 1440');
    expect(extractApiError(error, 'Falha')).toContain('Campo: durationMinutes');
  });

  it('parses human duration strings', () => {
    expect(parseDurationToMinutes('8h')).toBe(480);
    expect(parseDurationToMinutes('1h 30m')).toBe(90);
    expect(parseDurationToMinutes('90m')).toBe(90);
  });
});
