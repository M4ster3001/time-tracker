import { describe, expect, it } from 'vitest';
import {
  buildWorkingDays,
  formatEffectiveDate,
  getNextMonthEffectiveDate,
} from './allocationDate.calculators';

describe('allocationDate.calculators', () => {
  it('conta os dias uteis de um mes comum (janeiro/2026, comeca numa quinta)', () => {
    expect(buildWorkingDays(2026, 1)).toBe(22);
  });

  it('conta os dias uteis de fevereiro em ano bissexto (2028)', () => {
    expect(buildWorkingDays(2028, 2)).toBe(21);
  });

  it('retorna o dia 1 do proximo mes em UTC', () => {
    const reference = new Date(Date.UTC(2026, 6, 20));
    const result = getNextMonthEffectiveDate(reference);
    expect(result.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('vira o ano ao calcular o proximo mes a partir de dezembro', () => {
    const reference = new Date(Date.UTC(2026, 11, 15));
    const result = getNextMonthEffectiveDate(reference);
    expect(result.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('formata a data efetiva no padrao pt-BR', () => {
    expect(formatEffectiveDate(new Date(Date.UTC(2026, 7, 1)))).toBe('01/08/2026');
  });
});
