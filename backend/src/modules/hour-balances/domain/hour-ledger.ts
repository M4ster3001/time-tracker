export type LedgerRow = {
  id: number;
  deltaMinutes: number;
  kind: string;
  createdAt: Date;
  expiresAt: Date | null;
  expiresCreditId: number | null;
};
export type CreditLot = { id: number; remaining: number; expiresAt: Date | null; createdAt: Date };
export type Allocation = { minutes: number; expiresAt: Date | null };

// Replay is deterministic: expiry first, then acquisition order, then row id.
// Expiry is represented by an explicit movement, not a disappearing balance.
export const replayLedger = (rows: LedgerRow[]) => {
  const lots = new Map<number, CreditLot>();
  const allocations = new Map<number, Allocation[]>();
  let balance = 0;
  for (const row of [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id
  )) {
    if (row.deltaMinutes > 0) {
      const available = Math.max(0, row.deltaMinutes - Math.max(0, -balance));
      lots.set(row.id, {
        id: row.id,
        remaining: available,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      });
    } else if (row.deltaMinutes < 0 && row.expiresCreditId !== null) {
      const lot = lots.get(row.expiresCreditId);
      if (!lot || lot.remaining < -row.deltaMinutes) throw new Error('INVALID_EXPIRATION_MOVEMENT');
      lot.remaining += row.deltaMinutes;
    } else if (row.deltaMinutes < 0) {
      let remaining = -row.deltaMinutes;
      const consumed: Allocation[] = [];
      const ordered = [...lots.values()]
        .filter((lot) => lot.remaining > 0)
        .sort(
          (a, b) =>
            (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity) ||
            a.createdAt.getTime() - b.createdAt.getTime() ||
            a.id - b.id
        );
      for (const lot of ordered) {
        const minutes = Math.min(remaining, lot.remaining);
        if (!minutes) break;
        lot.remaining -= minutes;
        remaining -= minutes;
        consumed.push({ minutes, expiresAt: lot.expiresAt });
      }
      if (remaining) consumed.push({ minutes: remaining, expiresAt: null });
      allocations.set(row.id, consumed);
    }
    balance += row.deltaMinutes;
  }
  return { balance, lots, allocations };
};
