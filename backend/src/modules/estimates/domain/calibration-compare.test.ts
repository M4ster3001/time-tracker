import { describe, expect, it } from 'vitest';
import { compareCalibrationSample, type CalibrationSampleRow } from './calibration-compare.js';

describe('CAL-01 calibration comparison', () => {
  it('compara estimado x confirmado e inclui medido quando disponivel', () => {
    const rows: CalibrationSampleRow[] = [
      { estimatedMinutes: 150, confirmedMinutes: 135, actualTrackedMinutes: 126 },
      { estimatedMinutes: 60, confirmedMinutes: 60, actualTrackedMinutes: null },
      { estimatedMinutes: 100, confirmedMinutes: 80, actualTrackedMinutes: 90 },
    ];
    const result = compareCalibrationSample(rows);
    expect(result.sampleSize).toBe(3);
    expect(result.estimatedVsConfirmed.medianAbsoluteErrorMinutes).toBe(15);
    expect(result.estimatedVsConfirmed.biasMinutes).toBeCloseTo((15 + 0 + 20) / 3);
    expect(result.estimatedVsMeasured.sampleSize).toBe(2);
    expect(result.estimatedVsMeasured.medianAbsoluteErrorMinutes).toBe(17);
    expect(result.rowsExcludedForMissingMeasured).toBe(1);
  });

  it('nao inventa medido a partir de confirmado', () => {
    const result = compareCalibrationSample([
      { estimatedMinutes: 100, confirmedMinutes: 90, actualTrackedMinutes: null },
    ]);
    expect(result.estimatedVsMeasured.sampleSize).toBe(0);
    expect(result.estimatedVsMeasured.medianAbsoluteErrorMinutes).toBeNull();
  });

  it('exige amostra minima positiva', () => {
    expect(() => compareCalibrationSample([])).toThrow(/CALIBRATION_SAMPLE_EMPTY/);
  });
});
