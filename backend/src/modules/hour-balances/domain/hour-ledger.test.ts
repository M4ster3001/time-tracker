import { describe, expect, it } from 'vitest';
import { replayLedger, type LedgerRow } from './hour-ledger.js';
const date = (value: string) => new Date(`${value}T00:00:00Z`);
const row = (
  id: number,
  deltaMinutes: number,
  expiresAt: Date | null = null,
  expiresCreditId: number | null = null
): LedgerRow => ({
  id,
  deltaMinutes,
  expiresAt,
  expiresCreditId,
  kind: 'TEST',
  createdAt: date('2026-01-01'),
});

describe('hour ledger', () => {
  it('consumes expiring credits first and records the original validity for restoration', () => {
    const expiry = date('2026-02-01');
    const result = replayLedger([row(1, 100), row(2, 60, expiry), row(3, -90)]);
    expect(result.balance).toBe(70);
    expect(result.lots.get(1)?.remaining).toBe(70);
    expect(result.allocations.get(3)).toEqual([
      { minutes: 60, expiresAt: expiry },
      { minutes: 30, expiresAt: null },
    ]);
  });
  it('only expires the unused portion of a particular credit', () => {
    const result = replayLedger([
      row(1, 100),
      row(2, 60, date('2026-02-01')),
      row(3, -30),
      row(4, -30, null, 2),
    ]);
    expect(result.balance).toBe(100);
    expect(result.lots.get(1)?.remaining).toBe(100);
    expect(result.lots.get(2)?.remaining).toBe(0);
  });
  it('new credits cover debt before creating an expirable lot', () => {
    const result = replayLedger([
      row(1, -100),
      row(2, 150, date('2026-02-01')),
      row(3, -50, null, 2),
    ]);
    expect(result.balance).toBe(0);
    expect(result.lots.get(2)?.remaining).toBe(0);
  });
  it('replaying out of order rows produces the same state', () => {
    const rows = [row(1, 90), row(2, -20), row(3, 10)];
    expect(replayLedger(rows)).toEqual(replayLedger([...rows].reverse()));
  });
  it('rejects an expiration or targeted reversal larger than the remaining lot', () => {
    expect(() => replayLedger([row(1, 60), row(2, -61, null, 1)])).toThrow(
      'INVALID_EXPIRATION_MOVEMENT'
    );
  });
});
