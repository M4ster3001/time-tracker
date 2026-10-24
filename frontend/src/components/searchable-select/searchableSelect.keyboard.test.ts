import { describe, expect, it } from 'vitest';
import { clampActiveIndex, nextActiveIndex } from './searchableSelect.keyboard';

describe('searchableSelect.keyboard', () => {
  it('clamps within bounds and treats empty lists as index 0', () => {
    expect(clampActiveIndex(-1, 3)).toBe(0);
    expect(clampActiveIndex(9, 3)).toBe(2);
    expect(clampActiveIndex(1, 0)).toBe(0);
  });

  it('moves with arrows, Home, and End', () => {
    expect(nextActiveIndex(0, 4, 'down')).toBe(1);
    expect(nextActiveIndex(3, 4, 'down')).toBe(3);
    expect(nextActiveIndex(2, 4, 'up')).toBe(1);
    expect(nextActiveIndex(0, 4, 'up')).toBe(0);
    expect(nextActiveIndex(2, 4, 'home')).toBe(0);
    expect(nextActiveIndex(0, 4, 'end')).toBe(3);
    expect(nextActiveIndex(0, 0, 'down')).toBe(0);
  });
});
