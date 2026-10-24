import { describe, expect, it } from 'vitest';
import { parseDurationMinutes } from './duration.js';

describe('shared duration domain', () => {
  it('aceita minutos puros', () => {
    expect(parseDurationMinutes('90')).toBe(90);
    expect(parseDurationMinutes(45)).toBe(45);
  });

  it('aceita horas com minutos', () => {
    expect(parseDurationMinutes('1h')).toBe(60);
    expect(parseDurationMinutes('1h 30m')).toBe(90);
    expect(parseDurationMinutes('2h15m')).toBe(135);
    expect(parseDurationMinutes('2 hr 15 min')).toBe(135);
    expect(parseDurationMinutes('1hour 5minutes')).toBe(65);
  });

  it('aceita horas decimais', () => {
    expect(parseDurationMinutes('1.5h')).toBe(90);
  });

  it('retorna null para entradas invalidas', () => {
    expect(parseDurationMinutes('abc')).toBeNull();
    expect(parseDurationMinutes('')).toBeNull();
  });

  it('retorna null para tipos invalidos', () => {
    expect(parseDurationMinutes({} as never)).toBeNull();
  });

  it('retorna null para numeros nao finitos', () => {
    expect(parseDurationMinutes(Number.NaN)).toBeNull();
    expect(parseDurationMinutes(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
