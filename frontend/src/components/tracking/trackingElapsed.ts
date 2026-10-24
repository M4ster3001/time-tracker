/** Live session clock for portal timer UI. Not Actual Tracked Duration. */

export type LiveTrackingSession = {
  state: 'RUNNING' | 'PAUSED' | 'STOPPED';
  startedAt: string | Date;
  pausedAt?: string | Date | null;
  accumulatedPausedMs: number;
};

const toMs = (value: string | Date): number => {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * Elapsed minutes of an open session for display only.
 * Actual Tracked Duration is computed server-side from STOPPED sessions only —
 * never invent tracked minutes from this helper.
 */
export const computeLiveSessionElapsedMinutes = (
  session: LiveTrackingSession | null | undefined,
  now: Date = new Date()
): number | null => {
  if (!session || session.state === 'STOPPED') return null;
  const startedMs = toMs(session.startedAt);
  if (!startedMs) return null;

  const pausedMs = Math.max(0, session.accumulatedPausedMs ?? 0);

  if (session.state === 'RUNNING') {
    return Math.max(0, Math.floor((now.getTime() - startedMs - pausedMs) / 60_000));
  }

  // PAUSED: freeze at pause instant (current pause not yet in accumulatedPausedMs)
  const pausedAtMs = session.pausedAt ? toMs(session.pausedAt) : now.getTime();
  return Math.max(0, Math.floor((pausedAtMs - startedMs - pausedMs) / 60_000));
};

export const formatSessionClock = (totalMinutes: number | null): string => {
  if (totalMinutes == null) return '—';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
