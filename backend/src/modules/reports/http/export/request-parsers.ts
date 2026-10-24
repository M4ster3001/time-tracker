import { BadRequestError } from '../../../../app/errors/app-error.js';
import type { AdminExportFormat, ExportPeriod, ExportRequestParams } from './types.js';

const parsePositiveInteger = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) return undefined;
  return numeric;
};

export const parseExportPeriods = (periodsParam: unknown): ExportPeriod[] => {
  if (!periodsParam) return [];

  const rawInput =
    typeof periodsParam === 'string'
      ? periodsParam
      : Array.isArray(periodsParam)
        ? periodsParam[0]
        : undefined;

  if (!rawInput || typeof rawInput !== 'string') {
    throw new BadRequestError('Invalid periods parameter');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawInput);
  } catch (_error) {
    throw new BadRequestError('Invalid periods JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new BadRequestError('periods must be an array');
  }

  const unique = new Map<string, ExportPeriod>();
  parsed.forEach((item) => {
    if (!item || typeof item !== 'object') {
      throw new BadRequestError('Invalid period item');
    }
    const candidate = item as { month?: unknown; year?: unknown };
    const month = Number(candidate.month);
    const year = Number(candidate.year);
    if (
      Number.isNaN(month) ||
      Number.isNaN(year) ||
      month < 1 ||
      month > 12 ||
      year < 2000 ||
      year > 2100
    ) {
      throw new BadRequestError('Invalid period values');
    }
    const key = `${year}-${month}`;
    if (!unique.has(key)) {
      unique.set(key, { year, month });
    }
  });

  const periods = Array.from(unique.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  if (periods.length > 24) {
    throw new BadRequestError('Maximum 24 periods are allowed');
  }

  return periods;
};

export const parseExportRequest = (query: Record<string, unknown>): ExportRequestParams => {
  const periods = parseExportPeriods(query.periods);
  const month = parsePositiveInteger(query.month);
  const year = parsePositiveInteger(query.year);
  const consultantId = parsePositiveInteger(query.consultantId);
  const clientId = parsePositiveInteger(query.clientId);
  const mode = typeof query.mode === 'string' ? query.mode : undefined;
  const requestedFormatRaw = typeof query.format === 'string' ? query.format : undefined;

  if (
    requestedFormatRaw &&
    requestedFormatRaw !== 'executive' &&
    requestedFormatRaw !== 'detailed'
  ) {
    throw new BadRequestError('Invalid export format');
  }

  return {
    periods,
    month,
    year,
    consultantId,
    clientId,
    mode,
    requestedFormat: (requestedFormatRaw as AdminExportFormat | undefined) ?? null,
  };
};
