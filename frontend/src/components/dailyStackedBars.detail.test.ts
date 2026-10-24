import { describe, expect, it } from 'vitest';
import { dailyBarFocusKey, parseDailyBarFocusKey } from './dailyStackedBars.detail';

describe('dailyStackedBars focus keys', () => {
  it('round-trips date and clientId for keyboard detail panel', () => {
    const key = dailyBarFocusKey('2026-10-15', 42);
    expect(parseDailyBarFocusKey(key)).toEqual({ date: '2026-10-15', clientId: 42 });
  });

  it('rejects malformed keys', () => {
    expect(parseDailyBarFocusKey(null)).toBeNull();
    expect(parseDailyBarFocusKey('nodash')).toBeNull();
    expect(parseDailyBarFocusKey('2026-10-15:x')).toBeNull();
  });
});
