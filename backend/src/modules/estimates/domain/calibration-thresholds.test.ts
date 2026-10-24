import { describe, expect, it } from 'vitest';
import type { CalibrationComparisonResult } from './calibration-compare.js';
import {
  DEFAULT_CALIBRATION_THRESHOLDS,
  evaluateCalibrationThresholds,
  parseCalibrationThresholdConfig,
} from './calibration-thresholds.js';

const sample = (
  overrides: Partial<CalibrationComparisonResult> = {}
): CalibrationComparisonResult => ({
  sampleSize: 10,
  estimatedVsConfirmed: {
    sampleSize: 10,
    medianAbsoluteErrorMinutes: 12,
    biasMinutes: -3,
  },
  estimatedVsMeasured: {
    sampleSize: 4,
    medianAbsoluteErrorMinutes: 20,
    biasMinutes: 5,
  },
  rowsExcludedForMissingMeasured: 6,
  ...overrides,
});

describe('CAL-01 calibration thresholds (no invented defaults)', () => {
  it('defaults todos null — nenhum gate configurado; approve humano livre', () => {
    expect(DEFAULT_CALIBRATION_THRESHOLDS).toEqual({
      minSampleSize: null,
      minMeasuredSampleSize: null,
      maxMedianAbsoluteErrorMinutes: null,
      maxAbsoluteBiasMinutes: null,
    });
    const evaluation = evaluateCalibrationThresholds(
      sample(),
      DEFAULT_CALIBRATION_THRESHOLDS
    );
    expect(evaluation.configuredGateCount).toBe(0);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.failures).toEqual([]);
  });

  it('parse rejeita numeros invalidos; aceita null explicito', () => {
    expect(parseCalibrationThresholdConfig(null)).toEqual(DEFAULT_CALIBRATION_THRESHOLDS);
    expect(
      parseCalibrationThresholdConfig({
        minSampleSize: 30,
        minMeasuredSampleSize: null,
        maxMedianAbsoluteErrorMinutes: 15,
        maxAbsoluteBiasMinutes: 8,
      })
    ).toEqual({
      minSampleSize: 30,
      minMeasuredSampleSize: null,
      maxMedianAbsoluteErrorMinutes: 15,
      maxAbsoluteBiasMinutes: 8,
    });
    expect(() => parseCalibrationThresholdConfig({ minSampleSize: 0 })).toThrow(
      'CALIBRATION_THRESHOLD_INVALID'
    );
    expect(() => parseCalibrationThresholdConfig({ minSampleSize: 1.5 })).toThrow(
      'CALIBRATION_THRESHOLD_INVALID'
    );
  });

  it('gates configurados falham quando amostra/metricas nao atendem', () => {
    const evaluation = evaluateCalibrationThresholds(sample({ sampleSize: 5 }), {
      minSampleSize: 20,
      minMeasuredSampleSize: 10,
      maxMedianAbsoluteErrorMinutes: 10,
      maxAbsoluteBiasMinutes: 2,
    });
    expect(evaluation.configuredGateCount).toBe(4);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.failures).toEqual([
      'MIN_SAMPLE_SIZE',
      'MIN_MEASURED_SAMPLE_SIZE',
      'MAX_MEDIAN_ABSOLUTE_ERROR',
      'MAX_ABSOLUTE_BIAS',
    ]);
  });

  it('gates configurados passam quando metricas cabem', () => {
    const evaluation = evaluateCalibrationThresholds(sample(), {
      minSampleSize: 8,
      minMeasuredSampleSize: 3,
      maxMedianAbsoluteErrorMinutes: 15,
      maxAbsoluteBiasMinutes: 5,
    });
    expect(evaluation.passed).toBe(true);
    expect(evaluation.failures).toEqual([]);
  });
});
