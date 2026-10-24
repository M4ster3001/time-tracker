/**
 * TRK-01 — sessoes de medicao opcional (plano §4.4).
 * Actual Tracked Duration so deriva destas sessoes; nunca de calendario/commits/IA.
 */

export type TrackingSessionState = 'RUNNING' | 'PAUSED' | 'STOPPED';
export type TrackingSessionAction = 'start' | 'pause' | 'resume' | 'stop';
export type TrackingSessionSource = 'TIMER' | 'IMPORT';

export type TrackingSessionSnapshot = {
  id?: number;
  userId: number;
  timeEntryId: number | null;
  state: TrackingSessionState;
  startedAt: Date;
  endedAt: Date | null;
  pausedAt: Date | null;
  accumulatedPausedMs: number;
  source: TrackingSessionSource;
  externalId: string | null;
};

export type TrackingInterval = {
  state: TrackingSessionState;
  startedAt: Date;
  endedAt: Date | null;
  accumulatedPausedMs: number;
};

type TransitionInput = {
  action: TrackingSessionAction;
  session: TrackingSessionSnapshot | null;
  at: Date;
  userId?: number;
  timeEntryId?: number | null;
  source?: TrackingSessionSource;
  externalId?: string | null;
};

export const applyTrackingSessionTransition = (
  input: TransitionInput
): TrackingSessionSnapshot => {
  const at = input.at;

  if (input.action === 'start') {
    if (input.session && input.session.state !== 'STOPPED') {
      throw new Error('TRACKING_SESSION_ALREADY_OPEN');
    }
    if (input.userId == null) throw new Error('TRACKING_USER_REQUIRED');
    return {
      userId: input.userId,
      timeEntryId: input.timeEntryId ?? null,
      state: 'RUNNING',
      startedAt: at,
      endedAt: null,
      pausedAt: null,
      accumulatedPausedMs: 0,
      source: input.source ?? 'TIMER',
      externalId: input.externalId ?? null,
    };
  }

  if (!input.session) throw new Error('TRACKING_SESSION_REQUIRED');
  const session = input.session;

  if (session.state === 'STOPPED') {
    throw new Error('TRACKING_INVALID_TRANSITION');
  }

  if (input.action === 'pause') {
    if (session.state !== 'RUNNING') throw new Error('TRACKING_INVALID_TRANSITION');
    return { ...session, state: 'PAUSED', pausedAt: at };
  }

  if (input.action === 'resume') {
    if (session.state !== 'PAUSED' || !session.pausedAt) {
      throw new Error('TRACKING_INVALID_TRANSITION');
    }
    const pauseMs = Math.max(0, at.getTime() - session.pausedAt.getTime());
    return {
      ...session,
      state: 'RUNNING',
      pausedAt: null,
      accumulatedPausedMs: session.accumulatedPausedMs + pauseMs,
    };
  }

  // stop
  let accumulatedPausedMs = session.accumulatedPausedMs;
  if (session.state === 'PAUSED' && session.pausedAt) {
    accumulatedPausedMs += Math.max(0, at.getTime() - session.pausedAt.getTime());
  }
  return {
    ...session,
    state: 'STOPPED',
    endedAt: at,
    pausedAt: null,
    accumulatedPausedMs,
  };
};

/**
 * TRK-01 — importacao de rastreador externo como sessao ja STOPPED.
 * Exige externalId (dedupe); nao inventa ociosidade; nao abre timer.
 */
export type ImportTrackingSessionInput = {
  userId: number;
  timeEntryId?: number | null;
  externalId: string;
  startedAt: Date;
  endedAt: Date;
  accumulatedPausedMs?: number;
};

export const buildImportedTrackingSession = (
  input: ImportTrackingSessionInput
): TrackingSessionSnapshot => {
  const externalId = input.externalId.trim();
  if (!externalId) throw new Error('TRACKING_EXTERNAL_ID_REQUIRED');
  if (!(input.startedAt instanceof Date) || Number.isNaN(input.startedAt.getTime())) {
    throw new Error('TRACKING_IMPORT_STARTED_AT_INVALID');
  }
  if (!(input.endedAt instanceof Date) || Number.isNaN(input.endedAt.getTime())) {
    throw new Error('TRACKING_IMPORT_ENDED_AT_INVALID');
  }
  if (input.endedAt.getTime() < input.startedAt.getTime()) {
    throw new Error('TRACKING_IMPORT_RANGE_INVALID');
  }
  const accumulatedPausedMs = Math.max(0, Math.floor(input.accumulatedPausedMs ?? 0));
  const wallMs = input.endedAt.getTime() - input.startedAt.getTime();
  if (accumulatedPausedMs > wallMs) {
    throw new Error('TRACKING_IMPORT_PAUSE_EXCEEDS_RANGE');
  }
  return {
    userId: input.userId,
    timeEntryId: input.timeEntryId ?? null,
    state: 'STOPPED',
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    pausedAt: null,
    accumulatedPausedMs,
    source: 'IMPORT',
    externalId,
  };
};

/** Decisao pura de idempotencia por (source IMPORT, externalId). */
export const resolveImportIdempotency = (
  existing: Pick<TrackingSessionSnapshot, 'userId'> | null,
  next: Pick<TrackingSessionSnapshot, 'userId'>
): 'create' | 'reuse' | 'conflict' => {
  if (!existing) return 'create';
  if (existing.userId !== next.userId) return 'conflict';
  return 'reuse';
};

/**
 * Agrega apenas sessoes STOPPED. Sem sessoes fechadas → null (Nao medido).
 * Zero e medicao valida.
 * Intervalos sobrepostos da mesma pessoa usam uniao de relogio (plano §4.4),
 * nao soma, para nao dobrar tempo medido.
 */
export const computeActualTrackedFromSessions = (
  intervals: TrackingInterval[]
): number | null => {
  const closed = intervals.filter(
    (interval): interval is TrackingInterval & { endedAt: Date } =>
      interval.state === 'STOPPED' && interval.endedAt != null
  );
  if (closed.length === 0) return null;

  const ranges = closed
    .map((interval) => ({
      start: interval.startedAt.getTime(),
      end: interval.endedAt.getTime(),
      pauseMs: Math.max(0, interval.accumulatedPausedMs),
    }))
    .filter((range) => range.end >= range.start)
    .sort((a, b) => a.start - b.start);

  if (ranges.length === 0) return 0;

  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ start: range.start, end: range.end });
    } else {
      last.end = Math.max(last.end, range.end);
    }
  }

  const unionWallMs = merged.reduce((sum, range) => sum + (range.end - range.start), 0);
  const pauseMs = ranges.reduce((sum, range) => sum + range.pauseMs, 0);
  return Math.max(0, Math.round((unionWallMs - pauseMs) / 60_000));
};
