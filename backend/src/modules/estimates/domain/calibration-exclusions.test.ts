import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_EXCLUSION_REASONS,
  filterCalibrationSampleRows,
  type CalibrationSampleRowWithExclusion,
} from './calibration-exclusions.js';

describe('CAL-01 calibration exclusions', () => {
  const rows: CalibrationSampleRowWithExclusion[] = [
    {
      estimatedMinutes: 60,
      confirmedMinutes: 55,
      actualTrackedMinutes: 50,
      exclusionReason: null,
    },
    {
      estimatedMinutes: 90,
      confirmedMinutes: 120,
      actualTrackedMinutes: null,
      exclusionReason: 'SCOPE_CHANGED',
    },
    {
      estimatedMinutes: 45,
      confirmedMinutes: 40,
      actualTrackedMinutes: 20,
      exclusionReason: 'PARTIAL_SESSION',
    },
    {
      estimatedMinutes: 30,
      confirmedMinutes: 30,
      actualTrackedMinutes: 30,
      exclusionReason: 'CANCELLED',
    },
  ];

  it('catalogo de motivos e estavel e nao inclui limiares numericos', () => {
    expect(CALIBRATION_EXCLUSION_REASONS).toEqual([
      'CANCELLED',
      'SCOPE_CHANGED',
      'UNKNOWN_PAUSE',
      'PARTIAL_SESSION',
      'MULTI_PERSON_UNEQUAL_COVERAGE',
    ]);
  });

  it('por padrao exclui linhas com motivo e mantém elegiveis', () => {
    const result = filterCalibrationSampleRows(rows);
    expect(result.included).toHaveLength(1);
    expect(result.included[0]?.estimatedMinutes).toBe(60);
    expect(result.excludedCount).toBe(3);
    expect(result.excludedByReason).toEqual({
      SCOPE_CHANGED: 1,
      PARTIAL_SESSION: 1,
      CANCELLED: 1,
    });
  });

  it('permite manter motivos selecionados na amostra (sem inventar numeros)', () => {
    const result = filterCalibrationSampleRows(rows, {
      keepReasons: ['PARTIAL_SESSION'],
    });
    expect(result.included).toHaveLength(2);
    expect(result.excludedCount).toBe(2);
    expect(result.excludedByReason).toEqual({
      SCOPE_CHANGED: 1,
      CANCELLED: 1,
    });
  });
});
