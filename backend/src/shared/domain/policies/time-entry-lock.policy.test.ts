import { describe, expect, it } from 'vitest';
import { isEntryLocked, isMonthLocked, normalizeLockDay } from './time-entry-lock.policy.js';

describe('time entry lock policy', () => {
  it('normaliza dia de fechamento', () => {
    expect(normalizeLockDay(0)).toBe(1);
    expect(normalizeLockDay(31)).toBe(31);
    expect(normalizeLockDay(null)).toBeNull();
  });

  it('normaliza dia invalido', () => {
    expect(normalizeLockDay(Number.NaN)).toBeNull();
  });

  it('bloqueia entradas do mes anterior apos o dia de fechamento', () => {
    const entryDate = new Date('2024-01-10');
    const now = new Date('2024-02-06');
    expect(isEntryLocked(entryDate, 5, now)).toBe(true);
  });

  it('bloqueia entradas do mes anterior mesmo antes do dia de fechamento', () => {
    const entryDate = new Date('2024-01-10');
    const now = new Date('2024-02-02');
    expect(isEntryLocked(entryDate, 5, now)).toBe(true);
  });

  it('indica mes fechado com base no dia', () => {
    const now = new Date('2024-02-06');
    expect(isMonthLocked(2024, 2, 5, now)).toBe(false);
  });

  it('nao bloqueia se nao houver dia de fechamento', () => {
    const entryDate = new Date('2024-01-10');
    const now = new Date('2024-02-10');
    expect(isEntryLocked(entryDate, null, now)).toBe(false);
  });
});
