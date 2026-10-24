import { describe, expect, it } from 'vitest';
import {
  formatSkippedEntryIdsLabel,
  isActivityConfirmPartial,
  normalizeSkippedTimeEntryIds,
} from './activityConfirmPartial';

describe('EST-02 activityConfirmPartial UI helpers', () => {
  it('normaliza ids positivos unicos ordenados', () => {
    expect(normalizeSkippedTimeEntryIds([9, 2, 2, 0, -1, 3])).toEqual([2, 3, 9]);
  });

  it('partial so quando flag e skipped nao vazios', () => {
    expect(isActivityConfirmPartial({ partial: true, skippedTimeEntryIds: [2] })).toBe(true);
    expect(isActivityConfirmPartial({ partial: true, skippedTimeEntryIds: [] })).toBe(false);
    expect(isActivityConfirmPartial({ partial: false, skippedTimeEntryIds: [2] })).toBe(false);
    expect(isActivityConfirmPartial(null)).toBe(false);
  });

  it('formata lista de apontamentos pulados para o banner', () => {
    expect(formatSkippedEntryIdsLabel([9, 2])).toBe('#2, #9');
  });
});
