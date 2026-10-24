/**
 * CAL-01 — motivos de exclusao da amostra (plano §4.3).
 * Catalogo de politica; sem limiares numericos de piloto.
 */

import type { CalibrationSampleRow } from './calibration-compare.js';

export const CALIBRATION_EXCLUSION_REASONS = [
  'CANCELLED',
  'SCOPE_CHANGED',
  'UNKNOWN_PAUSE',
  'PARTIAL_SESSION',
  'MULTI_PERSON_UNEQUAL_COVERAGE',
] as const;

export type CalibrationExclusionReason = (typeof CALIBRATION_EXCLUSION_REASONS)[number];

export type CalibrationSampleRowWithExclusion = CalibrationSampleRow & {
  exclusionReason?: CalibrationExclusionReason | null;
};

export type FilterCalibrationSampleOptions = {
  /** Motivos que permanecem na amostra (ex.: analise separada). Default: nenhum. */
  keepReasons?: readonly CalibrationExclusionReason[];
};

export type FilterCalibrationSampleResult = {
  included: CalibrationSampleRow[];
  excludedCount: number;
  excludedByReason: Partial<Record<CalibrationExclusionReason, number>>;
};

const isExclusionReason = (value: unknown): value is CalibrationExclusionReason =>
  typeof value === 'string' &&
  (CALIBRATION_EXCLUSION_REASONS as readonly string[]).includes(value);

export const filterCalibrationSampleRows = (
  rows: CalibrationSampleRowWithExclusion[],
  options: FilterCalibrationSampleOptions = {}
): FilterCalibrationSampleResult => {
  const keep = new Set(options.keepReasons ?? []);
  const included: CalibrationSampleRow[] = [];
  const excludedByReason: Partial<Record<CalibrationExclusionReason, number>> = {};
  let excludedCount = 0;

  for (const row of rows) {
    const reason = row.exclusionReason ?? null;
    if (reason != null && isExclusionReason(reason) && !keep.has(reason)) {
      excludedCount += 1;
      excludedByReason[reason] = (excludedByReason[reason] ?? 0) + 1;
      continue;
    }
    included.push({
      estimatedMinutes: row.estimatedMinutes,
      confirmedMinutes: row.confirmedMinutes,
      actualTrackedMinutes: row.actualTrackedMinutes,
    });
  }

  return { included, excludedCount, excludedByReason };
};
