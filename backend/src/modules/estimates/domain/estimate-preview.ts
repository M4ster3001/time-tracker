/**
 * EST-01/02 — calculo deterministico de estimativa (plano §4.2).
 * estimativaBruta = base × fator; arredonda por politica versionada.
 */

export type RoundingMode = 'NEAREST_MINUTE' | 'CEIL_MINUTE' | 'FLOOR_MINUTE';

export type EstimatePreviewInput = {
  baseMinutes: number;
  factor: number;
  roundingMode?: RoundingMode;
};

export type EstimatePreviewResult = {
  baseMinutes: number;
  factor: number;
  rawMinutes: number;
  suggestedMinutes: number;
  roundingMode: RoundingMode;
  formula: string;
};

export const computeEstimatePreview = (input: EstimatePreviewInput): EstimatePreviewResult => {
  if (!Number.isFinite(input.baseMinutes) || input.baseMinutes <= 0) {
    throw new Error('ESTIMATE_BASE_INVALID');
  }
  if (!Number.isFinite(input.factor) || input.factor <= 0) {
    throw new Error('ESTIMATE_FACTOR_INVALID');
  }

  const roundingMode = input.roundingMode ?? 'NEAREST_MINUTE';
  const rawMinutes = input.baseMinutes * input.factor;
  let suggestedMinutes: number;
  if (roundingMode === 'CEIL_MINUTE') suggestedMinutes = Math.ceil(rawMinutes);
  else if (roundingMode === 'FLOOR_MINUTE') suggestedMinutes = Math.floor(rawMinutes);
  else suggestedMinutes = Math.round(rawMinutes);

  return {
    baseMinutes: input.baseMinutes,
    factor: input.factor,
    rawMinutes,
    suggestedMinutes,
    roundingMode,
    formula: `${input.baseMinutes} × ${input.factor} → ${suggestedMinutes} (${roundingMode})`,
  };
};
