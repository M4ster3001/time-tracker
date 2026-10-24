import React, { useCallback, useEffect, useState } from 'react';
import { useCapabilities } from '../../contexts/CapabilitiesContext';
import { text } from '../../i18n';
import { extractApiError, formatMinutes } from '../../utils/formatters';
import StateBanner from '../StateBanner';
import {
  fetchActiveTrackingSession,
  pauseTrackingSession,
  resumeTrackingSession,
  startTrackingSession,
  stopTrackingSession,
  type TrackingSession,
} from './tracking.service';
import { computeLiveSessionElapsedMinutes, formatSessionClock } from './trackingElapsed';

type Props = {
  /** Optional link to a time entry when starting the session. */
  timeEntryId?: number | null;
  /** Actual Tracked from the entry contract — never invent from the live clock. */
  actualTrackedMinutes?: number | null;
  actualTrackedStatus?: 'NOT_TRACKED' | 'TRACKED' | 'TRACKED_ZERO';
  onStopped?: () => void;
  className?: string;
};

const TrackingTimerWidget: React.FC<Props> = ({
  timeEntryId = null,
  actualTrackedMinutes = null,
  actualTrackedStatus = 'NOT_TRACKED',
  onStopped,
  className = '',
}) => {
  const { capabilities, can } = useCapabilities();
  const trackingEnabled = Boolean(capabilities?.flows?.tracking);
  const canRead = can('tracking.read');
  const canWrite = can('tracking.write');

  const [session, setSession] = useState<TrackingSession | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!trackingEnabled || !canRead) {
      setSession(null);
      return;
    }
    try {
      setSession(await fetchActiveTrackingSession());
      setError(null);
    } catch (err) {
      setError(extractApiError(err, text('Falha ao ler o timer.', 'Unable to load the timer.')));
    }
  }, [trackingEnabled, canRead]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!session || session.state !== 'RUNNING') return;
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, [session?.id, session?.state]);

  if (!trackingEnabled || !canRead) return null;

  const liveMinutes = computeLiveSessionElapsedMinutes(session, now);
  const actualLabel =
    actualTrackedStatus === 'NOT_TRACKED' || actualTrackedMinutes == null
      ? text('Não medido', 'Not tracked')
      : formatMinutes(actualTrackedMinutes);

  const run = async (action: () => Promise<TrackingSession | void>) => {
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      if (next) setSession(next.state === 'STOPPED' ? null : next);
      else await reload();
    } catch (err) {
      setError(extractApiError(err, text('Falha na medição.', 'Tracking action failed.')));
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`tt-panel ${className}`.trim()} aria-label={text('Medição', 'Tracking')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-tt-text">
            {text('Timer de medição', 'Tracking timer')}
          </h3>
          <p className="mt-1 text-xs text-tt-text-muted">
            {text(
              'O relógio ao vivo não é Duração medida. Actual Tracked Duration só atualiza ao parar uma sessão.',
              'The live clock is not Actual Tracked Duration. Actual Tracked updates only after a session is stopped.'
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-tt-text-muted">
            {text('Duração medida', 'Actual Tracked Duration')}
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-tt-text">
            {actualLabel}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-tt-text-muted" id="tracking-session-label">
            {text('Sessão atual', 'Current session')}
          </p>
          <p
            className="font-mono text-2xl font-semibold tabular-nums text-tt-text"
            aria-labelledby="tracking-session-label"
            aria-live="polite"
            aria-atomic="true"
          >
            {formatSessionClock(liveMinutes)}
          </p>
          <p className="text-xs text-tt-text-muted" role="status">
            {session
              ? session.state === 'RUNNING'
                ? text('Em execução', 'Running')
                : text('Pausado', 'Paused')
              : text('Sem sessão aberta', 'No open session')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!session ? (
            <button
              type="button"
              className="tt-btn-primary"
              disabled={busy || !canWrite}
              onClick={() => void run(() => startTrackingSession(timeEntryId))}
            >
              {text('Iniciar', 'Start')}
            </button>
          ) : null}
          {session?.state === 'RUNNING' ? (
            <button
              type="button"
              className="tt-btn-secondary"
              disabled={busy || !canWrite}
              onClick={() => void run(() => pauseTrackingSession(session.id))}
            >
              {text('Pausar', 'Pause')}
            </button>
          ) : null}
          {session?.state === 'PAUSED' ? (
            <button
              type="button"
              className="tt-btn-secondary"
              disabled={busy || !canWrite}
              onClick={() => void run(() => resumeTrackingSession(session.id))}
            >
              {text('Retomar', 'Resume')}
            </button>
          ) : null}
          {session ? (
            <button
              type="button"
              className="tt-btn-primary"
              disabled={busy || !canWrite}
              onClick={() =>
                void run(async () => {
                  const stopped = await stopTrackingSession(session.id);
                  onStopped?.();
                  return stopped;
                })
              }
            >
              {text('Parar', 'Stop')}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <StateBanner tone="error" className="mt-4" message={error} /> : null}
    </section>
  );
};

export default TrackingTimerWidget;
