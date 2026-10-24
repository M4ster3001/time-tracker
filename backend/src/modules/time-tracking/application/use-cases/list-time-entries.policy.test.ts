import { describe, expect, it } from 'vitest';
import { assertListTimeEntriesBounded } from './list-time-entries.policy.js';

describe('list-time-entries.policy', () => {
  it('requires year and month so lists are date-bounded', () => {
    expect(() => assertListTimeEntriesBounded({})).toThrow(/year and month/);
    expect(() => assertListTimeEntriesBounded({ clientId: 1 })).toThrow(/year and month/);
    expect(() => assertListTimeEntriesBounded({ year: 2024 })).toThrow(/year and month/);
    expect(() => assertListTimeEntriesBounded({ month: 1 })).toThrow(/year and month/);
  });

  it('accepts year+month with optional clientId', () => {
    expect(() => assertListTimeEntriesBounded({ year: 2024, month: 1 })).not.toThrow();
    expect(() =>
      assertListTimeEntriesBounded({ year: 2024, month: 1, clientId: 2 })
    ).not.toThrow();
  });
});
