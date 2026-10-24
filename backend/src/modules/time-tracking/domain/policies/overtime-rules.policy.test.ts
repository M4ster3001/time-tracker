import { describe, expect, it } from 'vitest';
import { computeOvertimeByAllocation } from './overtime-rules.policy.js';

describe('overtime-rules.policy', () => {
  it('considera 100% extra para cliente sem alocacao', () => {
    const result = computeOvertimeByAllocation(new Map([[10, 180]]), new Map());

    expect(result.targetMinutes).toBe(0);
    expect(result.normalMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(180);
    expect(result.overtimeByClient.get(10)).toBe(180);
  });

  it('limita horas normais na meta para cliente com alocacao', () => {
    const result = computeOvertimeByAllocation(new Map([[10, 600]]), new Map([[10, 480]]));

    expect(result.targetMinutes).toBe(480);
    expect(result.normalMinutes).toBe(480);
    expect(result.overtimeMinutes).toBe(120);
    expect(result.normalByClient.get(10)).toBe(480);
    expect(result.overtimeByClient.get(10)).toBe(120);
  });

  it('combina clientes com e sem alocacao no mesmo periodo', () => {
    const result = computeOvertimeByAllocation(
      new Map([
        [10, 600],
        [20, 120],
      ]),
      new Map([[10, 480]])
    );

    expect(result.targetMinutes).toBe(480);
    expect(result.normalMinutes).toBe(480);
    expect(result.overtimeMinutes).toBe(240);
    expect(result.overtimeByClient.get(10)).toBe(120);
    expect(result.overtimeByClient.get(20)).toBe(120);
  });
});
