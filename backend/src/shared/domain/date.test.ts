import { describe, expect, it } from 'vitest';
import {
  getClosingPeriodRangeUTC,
  getMonthRangeUTC,
  getWorkingDaysInMonth,
  getWorkingDaysInRange,
  normalizeDateOnly,
  parseDateOnly,
} from './date.js';

describe('shared date domain', () => {
  it('normalizeDateOnly zera horario', () => {
    const date = new Date('2024-01-15T10:20:30Z');
    const normalized = normalizeDateOnly(date);
    expect(normalized.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('parseDateOnly aceita string YYYY-MM-DD', () => {
    const parsed = parseDateOnly('2024-02-03');
    expect(parsed?.toISOString()).toBe('2024-02-03T00:00:00.000Z');
  });

  it('parseDateOnly retorna null para invalido', () => {
    expect(parseDateOnly('invalid')).toBeNull();
  });

  it('parseDateOnly retorna null para tipo invalido', () => {
    expect(parseDateOnly(123 as never)).toBeNull();
  });

  it('parseDateOnly aceita string com espacos', () => {
    const parsed = parseDateOnly(' 2024-02-03 ');
    expect(parsed?.toISOString()).toBe('2024-02-03T00:00:00.000Z');
  });

  it('parseDateOnly aceita Date valido', () => {
    const parsed = parseDateOnly(new Date('2024-03-10T10:00:00Z'));
    expect(parsed?.toISOString()).toBe('2024-03-10T00:00:00.000Z');
  });

  it('getMonthRangeUTC retorna inicio e fim do mes', () => {
    const range = getMonthRangeUTC(2024, 2);
    expect(range.start.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('getClosingPeriodRangeUTC respeita lockDay', () => {
    const range = getClosingPeriodRangeUTC(2024, 2, 24);
    expect(range.start.toISOString()).toBe('2024-01-25T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2024-02-24T00:00:00.000Z');
  });

  it('getClosingPeriodRangeUTC ajusta lockDay para fim do mes', () => {
    const range = getClosingPeriodRangeUTC(2024, 2, 31);
    expect(range.start.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('getWorkingDaysInMonth conta so dias uteis', () => {
    expect(getWorkingDaysInMonth(2024, 2)).toBeGreaterThan(0);
  });

  it('getWorkingDaysInRange conta so dias uteis no intervalo', () => {
    const start = new Date('2024-02-01T00:00:00.000Z');
    const end = new Date('2024-02-07T00:00:00.000Z');
    expect(getWorkingDaysInRange(start, end)).toBe(5);
  });
});
