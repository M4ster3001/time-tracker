import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale, text, translate } from './index';
import { formatCurrency, formatDate, formatMinutes, monthOptions } from '../utils/formatters';
describe('locale and hour formatting', () => {
  afterEach(() => setLocale('pt-BR'));
  it('changes labels, month names and dates without changing the currency', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(translate('Clientes')).toBe('Clients');
    expect(translate('Horarios de lembrete')).toBe('Reminder times');
    expect(translate('Tipos de tarefa')).toBe('Task types');
    expect(translate('Calibração')).toBe('Calibration');
    expect(translate('Duração estimada')).toBe('Estimated Duration');
    expect(translate('Duração medida')).toBe('Actual Tracked Duration');
    expect(translate('Exige projeto')).toBe('Requires project');
    expect(text('Horas', 'Time')).toBe('Time');
    expect(monthOptions[0].label).toBe('January');
    expect(formatDate('2026-01-31')).toBe('1/31/2026');
    expect(formatCurrency(1234.5)).toContain('1,234.50');
    setLocale('pt-BR');
    expect(monthOptions[0].label).toBe('janeiro');
    expect(translate('Clientes')).toBe('Clientes');
  });
  it('preserves a negative individual balance without negative remainders', () => {
    expect(formatMinutes(-90)).toBe('-1h 30m');
    expect(formatMinutes(-15)).toBe('-15m');
    expect(formatMinutes(0)).toBe('0m');
  });
});

describe('portuguese accents on legacy catalog copy', () => {
  afterEach(() => setLocale('pt-BR'));
  it('restores accents for known catalog strings in pt-BR only', () => {
    expect(translate('Historico')).toBe('Histórico');
    expect(translate('Lote de lancamentos')).toBe('Lote de lançamentos');
    expect(translate('Sem lancamentos neste periodo.')).toBe('Sem lançamentos neste período.');
    expect(translate('Clientes')).toBe('Clientes');
    setLocale('en');
    expect(translate('Historico')).toBe('History');
  });

  it('never rewrites text that is not catalog copy (e.g. user data)', () => {
    expect(translate('historico do cliente na reuniao')).toBe('historico do cliente na reuniao');
  });
});
