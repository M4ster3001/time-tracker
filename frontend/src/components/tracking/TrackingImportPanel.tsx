import React, { useEffect, useRef, useState } from 'react';
import { useCapabilities } from '../../contexts/CapabilitiesContext';
import { text } from '../../i18n';
import { isAbortError } from '../../utils/abort';
import { extractApiError } from '../../utils/formatters';
import StateBanner from '../StateBanner';
import { importTrackingSession } from './tracking.service';
import {
  buildTrackingImportPayload,
  type TrackingImportBuildResult,
} from './trackingImport';

type Props = {
  /** Prefills optional link when importing onto an existing entry. */
  timeEntryId?: number | null;
  onImported?: () => void;
  className?: string;
};

const validationMessage = (code: Extract<TrackingImportBuildResult, { ok: false }>['code']) => {
  switch (code) {
    case 'TRACKING_EXTERNAL_ID_REQUIRED':
      return text('Informe o ID externo.', 'External ID is required.');
    case 'TRACKING_IMPORT_STARTED_AT_INVALID':
      return text('Início inválido.', 'Invalid start time.');
    case 'TRACKING_IMPORT_ENDED_AT_INVALID':
      return text('Fim inválido.', 'Invalid end time.');
    case 'TRACKING_IMPORT_RANGE_INVALID':
      return text('O fim deve ser após o início.', 'End must be after start.');
    case 'TRACKING_IMPORT_PAUSE_EXCEEDS_RANGE':
      return text(
        'Pausa acumulada maior que o intervalo.',
        'Paused time exceeds the range.'
      );
    case 'TRACKING_IMPORT_TIME_ENTRY_ID_INVALID':
      return text('ID do lançamento inválido.', 'Invalid time entry id.');
    case 'TRACKING_IMPORT_PAUSE_INVALID':
      return text('Pausa acumulada inválida.', 'Invalid accumulated pause.');
    default:
      return text('Dados de importação inválidos.', 'Invalid import data.');
  }
};

const TrackingImportPanel: React.FC<Props> = ({
  timeEntryId = null,
  onImported,
  className = '',
}) => {
  const { capabilities, can } = useCapabilities();
  const trackingEnabled = Boolean(capabilities?.flows?.tracking);
  const canWrite = can('tracking.write');

  const [externalId, setExternalId] = useState('');
  const [startedAtLocal, setStartedAtLocal] = useState('');
  const [endedAtLocal, setEndedAtLocal] = useState('');
  const [timeEntryIdRaw, setTimeEntryIdRaw] = useState(
    timeEntryId != null ? String(timeEntryId) : ''
  );
  const [accumulatedPausedMsRaw, setAccumulatedPausedMsRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timeEntryId != null) setTimeEntryIdRaw(String(timeEntryId));
  }, [timeEntryId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!trackingEnabled || !canWrite) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const built = buildTrackingImportPayload({
      externalId,
      startedAtLocal,
      endedAtLocal,
      timeEntryIdRaw,
      accumulatedPausedMsRaw,
    });
    if (!built.ok) {
      setError(validationMessage(built.code));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      const result = await importTrackingSession(built.payload, controller.signal);
      setSuccess(
        result.created
          ? text('Sessão importada.', 'Session imported.')
          : text(
              'Mesmo ID externo — sessão reutilizada (idempotente).',
              'Same external ID — session reused (idempotent).'
            )
      );
      onImported?.();
    } catch (err) {
      if (isAbortError(err)) return;
      setError(
        extractApiError(err, text('Falha ao importar a sessão.', 'Failed to import the session.'))
      );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <section
      className={`tt-panel ${className}`.trim()}
      aria-label={text('Importar medição', 'Import tracking')}
    >
      <div>
        <h3 className="text-base font-semibold text-tt-text">
          {text('Importar sessão externa', 'Import external session')}
        </h3>
        <p className="mt-1 text-xs text-tt-text-muted">
          {text(
            'Cria sessão STOPPED (fonte IMPORT) com dedupe por ID externo. Não liga ociosidade nem inventa limiares.',
            'Creates a STOPPED session (source IMPORT) with external ID dedupe. Does not enable idle policy or invent thresholds.'
          )}
        </p>
      </div>

      <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)} noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-tt-text">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-tt-text-muted">
              {text('ID externo', 'External ID')}
            </span>
            <input
              className="tt-input mt-0"
              type="text"
              name="externalId"
              autoComplete="off"
              required
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="block text-sm text-tt-text">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-tt-text-muted">
              {text('ID do lançamento (opcional)', 'Time entry ID (optional)')}
            </span>
            <input
              className="tt-input mt-0"
              type="number"
              name="timeEntryId"
              min={1}
              step={1}
              value={timeEntryIdRaw}
              onChange={(e) => setTimeEntryIdRaw(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="block text-sm text-tt-text">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-tt-text-muted">
              {text('Início', 'Start')}
            </span>
            <input
              className="tt-input mt-0"
              type="datetime-local"
              name="startedAt"
              required
              value={startedAtLocal}
              onChange={(e) => setStartedAtLocal(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="block text-sm text-tt-text">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-tt-text-muted">
              {text('Fim', 'End')}
            </span>
            <input
              className="tt-input mt-0"
              type="datetime-local"
              name="endedAt"
              required
              value={endedAtLocal}
              onChange={(e) => setEndedAtLocal(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="block text-sm text-tt-text sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-tt-text-muted">
              {text('Pausa acumulada (ms, opcional)', 'Accumulated pause (ms, optional)')}
            </span>
            <input
              className="tt-input mt-0"
              type="number"
              name="accumulatedPausedMs"
              min={0}
              step={1}
              value={accumulatedPausedMsRaw}
              onChange={(e) => setAccumulatedPausedMsRaw(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="tt-btn-primary" disabled={busy}>
            {busy
              ? text('Importando…', 'Importing…')
              : text('Importar sessão', 'Import session')}
          </button>
        </div>
      </form>

      {error ? <StateBanner tone="error" className="mt-4" message={error} /> : null}
      {success ? <StateBanner tone="success" className="mt-4" message={success} /> : null}
    </section>
  );
};

export default TrackingImportPanel;
