import { describe, expect, it } from 'vitest';
import {
  applyDurationConfirmation,
  nextConfirmationVersion,
} from './confirm-duration.js';

describe('EST-02 confirm duration', () => {
  it('preserva estimativa e espelha confirmado em durationMinutes', () => {
    const now = new Date('2026-10-15T12:00:00.000Z');
    const result = applyDurationConfirmation({
      durationMinutes: 90,
      estimatedDurationMinutes: 150,
      confirmedMinutes: 135,
      actorUserId: 7,
      now,
    });

    expect(result.estimatedDurationMinutes).toBe(150);
    expect(result.confirmedDurationMinutes).toBe(135);
    expect(result.durationMinutes).toBe(135);
    expect(result.confirmedByUserId).toBe(7);
    expect(result.confirmedAt).toBe(now);
    expect(result.confirmationVersion).toBe(1);
    expect(result.previousConfirmationId).toBeNull();
  });

  it('nao inventa estimativa quando o legado so tinha durationMinutes', () => {
    const result = applyDurationConfirmation({
      durationMinutes: 60,
      estimatedDurationMinutes: null,
      confirmedMinutes: 60,
      actorUserId: 1,
    });
    expect(result.estimatedDurationMinutes).toBeNull();
    expect(result.confirmedDurationMinutes).toBe(60);
  });

  it('rejeita confirmacao negativa', () => {
    expect(() =>
      applyDurationConfirmation({
        durationMinutes: 60,
        confirmedMinutes: -1,
        actorUserId: 1,
      })
    ).toThrow(/CONFIRMED_DURATION_INVALID/);
  });

  it('incrementa versao e aponta confirmacao anterior sem apagar estimativa', () => {
    const result = applyDurationConfirmation({
      durationMinutes: 135,
      estimatedDurationMinutes: 150,
      confirmedDurationMinutes: 135,
      confirmedMinutes: 120,
      actorUserId: 7,
      previousConfirmationId: 42,
      previousConfirmationVersion: 1,
      justification: 'ajuste apos revisao',
    });

    expect(result.estimatedDurationMinutes).toBe(150);
    expect(result.confirmedDurationMinutes).toBe(120);
    expect(result.confirmationVersion).toBe(2);
    expect(result.previousConfirmationId).toBe(42);
    expect(result.justification).toBe('ajuste apos revisao');
  });

  it('nextConfirmationVersion comeca em 1 e sobe a partir do anterior', () => {
    expect(nextConfirmationVersion(null)).toBe(1);
    expect(nextConfirmationVersion(undefined)).toBe(1);
    expect(nextConfirmationVersion(3)).toBe(4);
  });
});
