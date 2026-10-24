import { describe, expect, it } from 'vitest';
import {
  applyTrackingSessionTransition,
  buildImportedTrackingSession,
  computeActualTrackedFromSessions,
  resolveImportIdempotency,
  type TrackingSessionState,
  type TrackingSessionSnapshot,
} from './tracking-session.js';

const base = (overrides: Partial<TrackingSessionSnapshot> = {}): TrackingSessionSnapshot => ({
  id: 1,
  userId: 3,
  timeEntryId: 10,
  state: 'RUNNING',
  startedAt: new Date('2026-10-15T10:00:00.000Z'),
  endedAt: null,
  pausedAt: null,
  accumulatedPausedMs: 0,
  source: 'TIMER',
  externalId: null,
  ...overrides,
});

describe('TRK-01 tracking session transitions', () => {
  it('start cria sessao RUNNING', () => {
    const started = applyTrackingSessionTransition({
      action: 'start',
      session: null,
      userId: 3,
      timeEntryId: 10,
      at: new Date('2026-10-15T10:00:00.000Z'),
    });
    expect(started.state).toBe('RUNNING');
    expect(started.startedAt.toISOString()).toBe('2026-10-15T10:00:00.000Z');
    expect(started.endedAt).toBeNull();
  });

  it('pause so a partir de RUNNING e resume so a partir de PAUSED', () => {
    const running = base({ state: 'RUNNING' });
    const paused = applyTrackingSessionTransition({
      action: 'pause',
      session: running,
      at: new Date('2026-10-15T10:30:00.000Z'),
    });
    expect(paused.state).toBe('PAUSED');
    expect(paused.pausedAt?.toISOString()).toBe('2026-10-15T10:30:00.000Z');

    expect(() =>
      applyTrackingSessionTransition({
        action: 'pause',
        session: paused,
        at: new Date('2026-10-15T10:31:00.000Z'),
      })
    ).toThrow(/TRACKING_INVALID_TRANSITION/);

    const resumed = applyTrackingSessionTransition({
      action: 'resume',
      session: paused,
      at: new Date('2026-10-15T10:40:00.000Z'),
    });
    expect(resumed.state).toBe('RUNNING');
    expect(resumed.accumulatedPausedMs).toBe(10 * 60 * 1000);
    expect(resumed.pausedAt).toBeNull();
  });

  it('stop fecha sessao e rejeita nova transicao', () => {
    const stopped = applyTrackingSessionTransition({
      action: 'stop',
      session: base({ state: 'RUNNING' }),
      at: new Date('2026-10-15T11:00:00.000Z'),
    });
    expect(stopped.state).toBe('STOPPED');
    expect(stopped.endedAt?.toISOString()).toBe('2026-10-15T11:00:00.000Z');
    expect(() =>
      applyTrackingSessionTransition({
        action: 'resume',
        session: stopped,
        at: new Date('2026-10-15T11:01:00.000Z'),
      })
    ).toThrow(/TRACKING_INVALID_TRANSITION/);
  });

  it('rejeita start quando ja existe sessao aberta', () => {
    expect(() =>
      applyTrackingSessionTransition({
        action: 'start',
        session: base({ state: 'RUNNING' as TrackingSessionState }),
        userId: 3,
        timeEntryId: 10,
        at: new Date(),
      })
    ).toThrow(/TRACKING_SESSION_ALREADY_OPEN/);
  });
});

describe('TRK-01 actual tracked only from sessions', () => {
  it('soma intervalos validos e ignora sessao incompleta sem fim', () => {
    const minutes = computeActualTrackedFromSessions([
      {
        state: 'STOPPED',
        startedAt: new Date('2026-10-15T10:00:00.000Z'),
        endedAt: new Date('2026-10-15T11:00:00.000Z'),
        accumulatedPausedMs: 0,
      },
      {
        state: 'STOPPED',
        startedAt: new Date('2026-10-15T12:00:00.000Z'),
        endedAt: new Date('2026-10-15T12:30:00.000Z'),
        accumulatedPausedMs: 5 * 60 * 1000,
      },
      {
        state: 'RUNNING',
        startedAt: new Date('2026-10-15T13:00:00.000Z'),
        endedAt: null,
        accumulatedPausedMs: 0,
      },
    ]);
    // 60 + (30 - 5) = 85; sessao aberta nao conta como medido fechado
    expect(minutes).toBe(85);
  });

  it('retorna null quando nao ha sessoes STOPPED (Nao medido)', () => {
    expect(
      computeActualTrackedFromSessions([
        {
          state: 'RUNNING',
          startedAt: new Date('2026-10-15T10:00:00.000Z'),
          endedAt: null,
          accumulatedPausedMs: 0,
        },
      ])
    ).toBeNull();
  });

  it('zero e medicao valida quando sessao fechada com duracao zero', () => {
    expect(
      computeActualTrackedFromSessions([
        {
          state: 'STOPPED',
          startedAt: new Date('2026-10-15T10:00:00.000Z'),
          endedAt: new Date('2026-10-15T10:00:00.000Z'),
          accumulatedPausedMs: 0,
        },
      ])
    ).toBe(0);
  });

  it('une intervalos sobrepostos em vez de somar (plano §4.4)', () => {
    const minutes = computeActualTrackedFromSessions([
      {
        state: 'STOPPED',
        startedAt: new Date('2026-10-15T10:00:00.000Z'),
        endedAt: new Date('2026-10-15T11:00:00.000Z'),
        accumulatedPausedMs: 0,
      },
      {
        state: 'STOPPED',
        startedAt: new Date('2026-10-15T10:30:00.000Z'),
        endedAt: new Date('2026-10-15T11:30:00.000Z'),
        accumulatedPausedMs: 0,
      },
    ]);
    // Soma seria 120; uniao de relogio = 90
    expect(minutes).toBe(90);
  });

  it('importacao STOPPED entra no Actual Tracked como sessao fechada', () => {
    const imported = buildImportedTrackingSession({
      userId: 3,
      timeEntryId: 10,
      externalId: 'toggl:abc',
      startedAt: new Date('2026-10-15T10:00:00.000Z'),
      endedAt: new Date('2026-10-15T11:00:00.000Z'),
    });
    expect(computeActualTrackedFromSessions([imported])).toBe(60);
  });
});

describe('TRK-01 import external tracker (source IMPORT)', () => {
  it('cria sessao STOPPED com source IMPORT e externalId obrigatorio', () => {
    const imported = buildImportedTrackingSession({
      userId: 7,
      timeEntryId: 22,
      externalId: '  clockify:xyz  ',
      startedAt: new Date('2026-10-15T09:00:00.000Z'),
      endedAt: new Date('2026-10-15T09:45:00.000Z'),
      accumulatedPausedMs: 5 * 60 * 1000,
    });
    expect(imported).toMatchObject({
      userId: 7,
      timeEntryId: 22,
      state: 'STOPPED',
      source: 'IMPORT',
      externalId: 'clockify:xyz',
      pausedAt: null,
      accumulatedPausedMs: 5 * 60 * 1000,
    });
    expect(imported.endedAt?.toISOString()).toBe('2026-10-15T09:45:00.000Z');
  });

  it('rejeita import sem externalId, intervalo invertido ou pausa maior que a janela', () => {
    expect(() =>
      buildImportedTrackingSession({
        userId: 1,
        externalId: '   ',
        startedAt: new Date('2026-10-15T10:00:00.000Z'),
        endedAt: new Date('2026-10-15T11:00:00.000Z'),
      })
    ).toThrow(/TRACKING_EXTERNAL_ID_REQUIRED/);

    expect(() =>
      buildImportedTrackingSession({
        userId: 1,
        externalId: 'ext-1',
        startedAt: new Date('2026-10-15T12:00:00.000Z'),
        endedAt: new Date('2026-10-15T11:00:00.000Z'),
      })
    ).toThrow(/TRACKING_IMPORT_RANGE_INVALID/);

    expect(() =>
      buildImportedTrackingSession({
        userId: 1,
        externalId: 'ext-1',
        startedAt: new Date('2026-10-15T10:00:00.000Z'),
        endedAt: new Date('2026-10-15T10:10:00.000Z'),
        accumulatedPausedMs: 20 * 60 * 1000,
      })
    ).toThrow(/TRACKING_IMPORT_PAUSE_EXCEEDS_RANGE/);
  });

  it('idempotencia: reuso para o mesmo ator; conflito se outro usuario ja possui o externalId', () => {
    const next = buildImportedTrackingSession({
      userId: 3,
      externalId: 'ext-dup',
      startedAt: new Date('2026-10-15T10:00:00.000Z'),
      endedAt: new Date('2026-10-15T11:00:00.000Z'),
    });
    expect(resolveImportIdempotency(null, next)).toBe('create');
    expect(
      resolveImportIdempotency(base({ userId: 3, source: 'IMPORT', externalId: 'ext-dup' }), next)
    ).toBe('reuse');
    expect(
      resolveImportIdempotency(base({ userId: 9, source: 'IMPORT', externalId: 'ext-dup' }), next)
    ).toBe('conflict');
  });
});
