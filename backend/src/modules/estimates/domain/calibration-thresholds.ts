/**
 * CAL-01 — limiares versionaveis de amostra/promocao (plano §4.3).
 * Defaults sao null (sem gate): produto define numeros antes do piloto.
 * Nao inventar percentual/amostra minima de promocao.
 */

import type { CalibrationComparisonResult } from './calibration-compare.js';

export type CalibrationThresholdConfig = {
  /** Amostra minima (estimado×confirmado). null = gate desligado. */
  minSampleSize: number | null;
  /** Amostra minima com medicao. null = gate desligado. */
  minMeasuredSampleSize: number | null;
  /** Teto de erro absoluto mediano (min). null = gate desligado. */
  maxMedianAbsoluteErrorMinutes: number | null;
  /** Teto de |vies| medio (min). null = gate desligado. */
  maxAbsoluteBiasMinutes: number | null;
};

export const DEFAULT_CALIBRATION_THRESHOLDS: CalibrationThresholdConfig = {
  minSampleSize: null,
  minMeasuredSampleSize: null,
  maxMedianAbsoluteErrorMinutes: null,
  maxAbsoluteBiasMinutes: null,
};

export type CalibrationThresholdFailureCode =
  | 'MIN_SAMPLE_SIZE'
  | 'MIN_MEASURED_SAMPLE_SIZE'
  | 'MAX_MEDIAN_ABSOLUTE_ERROR'
  | 'MAX_ABSOLUTE_BIAS';

export type CalibrationThresholdEvaluation = {
  configuredGateCount: number;
  passed: boolean;
  failures: CalibrationThresholdFailureCode[];
};

const isPositiveIntOrNull = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === 'number' && Number.isInteger(value) && value > 0);

const isNonNegativeFiniteOrNull = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === 'number' && Number.isFinite(value) && value >= 0);

/** Normaliza payload admin/env; rejeita numeros inventados invalidos. */
export const parseCalibrationThresholdConfig = (
  raw: unknown
): CalibrationThresholdConfig => {
  if (raw == null || typeof raw !== 'object') {
    return { ...DEFAULT_CALIBRATION_THRESHOLDS };
  }
  const row = raw as Record<string, unknown>;
  const minSampleSize = row.minSampleSize === undefined ? null : row.minSampleSize;
  const minMeasuredSampleSize =
    row.minMeasuredSampleSize === undefined ? null : row.minMeasuredSampleSize;
  const maxMedianAbsoluteErrorMinutes =
    row.maxMedianAbsoluteErrorMinutes === undefined
      ? null
      : row.maxMedianAbsoluteErrorMinutes;
  const maxAbsoluteBiasMinutes =
    row.maxAbsoluteBiasMinutes === undefined ? null : row.maxAbsoluteBiasMinutes;

  if (!isPositiveIntOrNull(minSampleSize)) throw new Error('CALIBRATION_THRESHOLD_INVALID');
  if (!isPositiveIntOrNull(minMeasuredSampleSize)) {
    throw new Error('CALIBRATION_THRESHOLD_INVALID');
  }
  if (!isNonNegativeFiniteOrNull(maxMedianAbsoluteErrorMinutes)) {
    throw new Error('CALIBRATION_THRESHOLD_INVALID');
  }
  if (!isNonNegativeFiniteOrNull(maxAbsoluteBiasMinutes)) {
    throw new Error('CALIBRATION_THRESHOLD_INVALID');
  }

  return {
    minSampleSize,
    minMeasuredSampleSize,
    maxMedianAbsoluteErrorMinutes,
    maxAbsoluteBiasMinutes,
  };
};

export const evaluateCalibrationThresholds = (
  comparison: CalibrationComparisonResult,
  config: CalibrationThresholdConfig
): CalibrationThresholdEvaluation => {
  const failures: CalibrationThresholdFailureCode[] = [];
  let configuredGateCount = 0;

  if (config.minSampleSize != null) {
    configuredGateCount += 1;
    if (comparison.sampleSize < config.minSampleSize) failures.push('MIN_SAMPLE_SIZE');
  }
  if (config.minMeasuredSampleSize != null) {
    configuredGateCount += 1;
    if (comparison.estimatedVsMeasured.sampleSize < config.minMeasuredSampleSize) {
      failures.push('MIN_MEASURED_SAMPLE_SIZE');
    }
  }
  if (config.maxMedianAbsoluteErrorMinutes != null) {
    configuredGateCount += 1;
    const mae = comparison.estimatedVsConfirmed.medianAbsoluteErrorMinutes;
    if (mae == null || mae > config.maxMedianAbsoluteErrorMinutes) {
      failures.push('MAX_MEDIAN_ABSOLUTE_ERROR');
    }
  }
  if (config.maxAbsoluteBiasMinutes != null) {
    configuredGateCount += 1;
    const bias = comparison.estimatedVsConfirmed.biasMinutes;
    if (bias == null || Math.abs(bias) > config.maxAbsoluteBiasMinutes) {
      failures.push('MAX_ABSOLUTE_BIAS');
    }
  }

  return {
    configuredGateCount,
    passed: failures.length === 0,
    failures,
  };
};
