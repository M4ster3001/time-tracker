/**
 * CAL-01 — comparacao estimado × confirmado (e medido quando existir) (plano §4.3).
 */

export type CalibrationSampleRow = {
  estimatedMinutes: number;
  confirmedMinutes: number;
  actualTrackedMinutes: number | null;
};

export type CalibrationComparisonMetric = {
  sampleSize: number;
  medianAbsoluteErrorMinutes: number | null;
  biasMinutes: number | null;
};

export type CalibrationComparisonResult = {
  sampleSize: number;
  estimatedVsConfirmed: CalibrationComparisonMetric;
  estimatedVsMeasured: CalibrationComparisonMetric;
  rowsExcludedForMissingMeasured: number;
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
};

const mean = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

const metricAgainst = (
  rows: CalibrationSampleRow[],
  target: (row: CalibrationSampleRow) => number | null
): CalibrationComparisonMetric => {
  const errors: number[] = [];
  const signed: number[] = [];
  for (const row of rows) {
    const actual = target(row);
    if (actual == null) continue;
    const err = row.estimatedMinutes - actual;
    signed.push(err);
    errors.push(Math.abs(err));
  }
  return {
    sampleSize: errors.length,
    medianAbsoluteErrorMinutes: median(errors),
    biasMinutes: mean(signed),
  };
};

export const compareCalibrationSample = (
  rows: CalibrationSampleRow[]
): CalibrationComparisonResult => {
  if (rows.length === 0) throw new Error('CALIBRATION_SAMPLE_EMPTY');

  const estimatedVsConfirmed = metricAgainst(rows, (r) => r.confirmedMinutes);
  const estimatedVsMeasured = metricAgainst(rows, (r) => r.actualTrackedMinutes);
  const rowsExcludedForMissingMeasured = rows.filter(
    (r) => r.actualTrackedMinutes == null
  ).length;

  return {
    sampleSize: rows.length,
    estimatedVsConfirmed,
    estimatedVsMeasured,
    rowsExcludedForMissingMeasured,
  };
};
