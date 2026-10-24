import { describe, expect, it } from 'vitest';
import { computeEstimatePreview } from './estimate-preview.js';

describe('EST estimate preview', () => {
  it('calcula base × fator com arredondamento', () => {
    const result = computeEstimatePreview({ baseMinutes: 120, factor: 1.25 });
    expect(result.rawMinutes).toBe(150);
    expect(result.suggestedMinutes).toBe(150);
    expect(result.formula).toContain('120 × 1.25');
  });

  it('nao altera a estimativa original ao so inspecionar o resultado', () => {
    const first = computeEstimatePreview({ baseMinutes: 120, factor: 1.25 });
    const second = computeEstimatePreview({ baseMinutes: 120, factor: 1.25 });
    expect(first.suggestedMinutes).toBe(second.suggestedMinutes);
    expect(first.baseMinutes).toBe(120);
  });

  it('rejeita base ou fator invalidos', () => {
    expect(() => computeEstimatePreview({ baseMinutes: 0, factor: 1 })).toThrow(
      /ESTIMATE_BASE_INVALID/
    );
    expect(() => computeEstimatePreview({ baseMinutes: 60, factor: -1 })).toThrow(
      /ESTIMATE_FACTOR_INVALID/
    );
  });
});
