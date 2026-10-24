import React, { useCallback, useEffect, useState } from 'react';
import StateBanner from '../../../../components/StateBanner';
import { text, useLocale } from '../../../../i18n';
import { extractApiError, formatMinutes } from '../../../../utils/formatters';
import {
  confirmWorkActivityDuration,
  createEstimateRevision,
  createWorkActivity,
  fetchTaskTypes,
  fetchTimeEntryEstimateHistory,
  linkEstimationReference,
  linkLocalGitCommitReference,
  previewWorkActivityConfirmDuration,
  type ActivityConfirmPreview,
  type EstimateRevisionHistoryItem,
  type EstimateRevisionRow,
  type TaskTypeRow,
  type TimeEntryEstimateHistory,
} from '../services/estimates.service';
import type { TimeEntryDurationContract } from '../types/timeEntry.types';
import {
  formatSkippedEntryIdsLabel,
  isActivityConfirmPartial,
  normalizeSkippedTimeEntryIds,
} from './activityConfirmPartial';

type ConfirmationSnapshot = {
  confirmedMinutes: number | null;
  confirmedAt: string | null;
  confirmedByUserId: number | null;
};

type Props = {
  enabled: boolean;
  canPropose: boolean;
  canConfirm: boolean;
  timeEntryId: number;
  clientId: number;
  projectId: number | null;
  activityTitle: string;
  workActivityId: number | null;
  durations: TimeEntryDurationContract | null;
  confirmation: ConfirmationSnapshot | null;
  lastRevision: EstimateRevisionRow | null;
  onWorkActivityLinked: (workActivityId: number) => void;
  onRevisionCreated: (revision: EstimateRevisionRow) => void;
  onActivityConfirmed?: () => void;
};

const EstimateExplainPanel: React.FC<Props> = ({
  enabled,
  canPropose,
  canConfirm,
  timeEntryId,
  clientId,
  projectId,
  activityTitle,
  workActivityId,
  durations,
  confirmation,
  lastRevision,
  onWorkActivityLinked,
  onRevisionCreated,
  onActivityConfirmed,
}) => {
  const locale = useLocale();
  const [taskTypes, setTaskTypes] = useState<TaskTypeRow[]>([]);
  const [taskTypeCode, setTaskTypeCode] = useState('');
  const [baseMinutes, setBaseMinutes] = useState('60');
  const [factor, setFactor] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<TimeEntryEstimateHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refKind, setRefKind] = useState<'COMMIT' | 'PULL_REQUEST' | 'ISSUE' | 'DOCUMENT' | 'MANUAL'>(
    'COMMIT'
  );
  const [refProvider, setRefProvider] = useState('github');
  const [refExternalId, setRefExternalId] = useState('');
  const [refRepository, setRefRepository] = useState('');
  const [refTitle, setRefTitle] = useState('');
  const [refUri, setRefUri] = useState('');
  const [refBusy, setRefBusy] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [refMessage, setRefMessage] = useState<string | null>(null);
  const [localSha, setLocalSha] = useState('');
  const [localMessage, setLocalMessage] = useState('');
  const [localRepo, setLocalRepo] = useState('');
  const [localAuthorEmail, setLocalAuthorEmail] = useState('');
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [activityTotal, setActivityTotal] = useState('120');
  const [activityJustification, setActivityJustification] = useState('');
  const [activityPreview, setActivityPreview] = useState<ActivityConfirmPreview | null>(null);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityMessage, setActivityMessage] = useState<string | null>(null);
  const [activityPartialNotice, setActivityPartialNotice] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!enabled || !timeEntryId) return;
    setHistoryLoading(true);
    try {
      setHistory(await fetchTimeEntryEstimateHistory(timeEntryId));
      setHistoryError(null);
    } catch (err) {
      setHistory(null);
      setHistoryError(
        extractApiError(
          err,
          text('Não foi possível carregar o histórico.', 'Unable to load estimate history.')
        )
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [enabled, timeEntryId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, confirmation?.confirmedAt, lastRevision?.id]);

  useEffect(() => {
    if (!enabled || !canPropose) return;
    void fetchTaskTypes()
      .then(setTaskTypes)
      .catch(() => setTaskTypes([]));
  }, [enabled, canPropose]);

  if (!enabled) return null;

  const latestHistoryRevision: EstimateRevisionHistoryItem | null =
    history?.estimateRevisions[0] ?? null;
  const explainRevision = lastRevision ?? latestHistoryRevision;
  const confirmations = history?.durationConfirmations ?? [];
  const references = history?.estimationReferences ?? [];

  const linkReference = async () => {
    if (!canPropose || !refExternalId.trim() || !refProvider.trim()) return;
    setRefBusy(true);
    setRefError(null);
    setRefMessage(null);
    try {
      await linkEstimationReference({
        kind: refKind,
        provider: refProvider.trim(),
        externalId: refExternalId.trim(),
        repository: refRepository.trim() || null,
        title: refTitle.trim() || null,
        uri: refUri.trim() || null,
        timeEntryId,
        projectId,
      });
      setRefExternalId('');
      setRefTitle('');
      setRefUri('');
      await loadHistory();
      setRefMessage(
        text(
          'Evidência vinculada. Não conta como duração medida.',
          'Evidence linked. It does not count as Actual Tracked Duration.'
        )
      );
    } catch (err) {
      setRefError(extractApiError(err, text('Falha ao vincular evidência', 'Unable to link evidence')));
    } finally {
      setRefBusy(false);
    }
  };

  const linkLocalGit = async () => {
    if (!canPropose || !localSha.trim()) return;
    setLocalBusy(true);
    setLocalError(null);
    setLocalSuccess(null);
    try {
      await linkLocalGitCommitReference({
        sha: localSha.trim(),
        message: localMessage.trim(),
        repository: localRepo.trim(),
        authorEmail: localAuthorEmail.trim() || null,
        timeEntryId,
        projectId,
      });
      setLocalSha('');
      setLocalMessage('');
      setLocalAuthorEmail('');
      await loadHistory();
      setLocalSuccess(
        text(
          'Commit local vinculado (local-git). Não é Actual Tracked. Autor TT só com e-mail mapeado ou igual ao da conta.',
          'Local commit linked (local-git). Not Actual Tracked. TT author only when email maps or matches account.'
        )
      );
    } catch (err) {
      setLocalError(
        extractApiError(err, text('Falha ao vincular commit local', 'Unable to link local commit'))
      );
    } finally {
      setLocalBusy(false);
    }
  };

  const activityIdForConfirm = workActivityId ?? history?.workActivityId ?? null;

  const previewActivityConfirm = async () => {
    if (!canConfirm || activityIdForConfirm == null) return;
    const total = Number(activityTotal);
    if (!Number.isFinite(total)) return;
    setActivityBusy(true);
    setActivityError(null);
    setActivityMessage(null);
    setActivityPartialNotice(null);
    try {
      const preview = await previewWorkActivityConfirmDuration(activityIdForConfirm, total);
      setActivityPreview(preview);
      if (isActivityConfirmPartial(preview)) {
        const skipped = formatSkippedEntryIdsLabel(preview.skippedTimeEntryIds ?? []);
        setActivityPartialNotice(
          text(
            `Confirmação parcial: só os seus apontamentos autorizados entram no rateio. Fora do escopo: ${skipped}.`,
            `Partial confirmation: only your authorized entries are in the split. Out of scope: ${skipped}.`
          )
        );
      }
    } catch (err) {
      setActivityPreview(null);
      setActivityError(
        extractApiError(err, text('Falha na prévia do rateio', 'Unable to preview distribution'))
      );
    } finally {
      setActivityBusy(false);
    }
  };

  const confirmActivityDistributed = async () => {
    if (!canConfirm || activityIdForConfirm == null) return;
    const total = Number(activityTotal);
    if (!Number.isFinite(total)) return;
    setActivityBusy(true);
    setActivityError(null);
    setActivityMessage(null);
    setActivityPartialNotice(null);
    try {
      const justification = activityJustification.trim();
      const result = await confirmWorkActivityDuration(activityIdForConfirm, {
        confirmedMinutes: total,
        ...(justification ? { justification } : {}),
        ...(activityPreview
          ? {
              distribution: activityPreview.distribution.map((row) => ({
                timeEntryId: row.timeEntryId,
                confirmedMinutes: row.confirmedMinutes,
              })),
            }
          : {}),
      });
      await loadHistory();
      onActivityConfirmed?.();
      const summary = text(
        `Atividade confirmada: ${result.totalConfirmedMinutes} min em ${result.confirmations.length} apontamento(s).`,
        `Activity confirmed: ${result.totalConfirmedMinutes} min across ${result.confirmations.length} entr(y/ies).`
      );
      setActivityMessage(summary);
      if (isActivityConfirmPartial(result)) {
        const skipped = formatSkippedEntryIdsLabel(result.skippedTimeEntryIds ?? []);
        setActivityPartialNotice(
          text(
            `Confirmação parcial: apontamentos de outras pessoas não foram alterados (${skipped}).`,
            `Partial confirmation: other people's entries were left unchanged (${skipped}).`
          )
        );
      }
    } catch (err) {
      setActivityError(
        extractApiError(err, text('Falha ao confirmar atividade', 'Unable to confirm activity'))
      );
    } finally {
      setActivityBusy(false);
    }
  };

  const createEstimate = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let activityId = workActivityId ?? history?.workActivityId ?? null;
      if (activityId == null) {
        const activity = await createWorkActivity({
          clientId,
          title: activityTitle.trim() || text('Atividade', 'Activity'),
          projectId,
          description: activityTitle,
          taskTypeCode: taskTypeCode || null,
          timeEntryId,
        });
        activityId = activity.id;
        onWorkActivityLinked(activityId);
      }
      const result = await createEstimateRevision(activityId, {
        baseMinutes: taskTypeCode ? undefined : Number(baseMinutes),
        factor: taskTypeCode ? undefined : Number(factor),
        origin: taskTypeCode ? 'CATALOG' : 'ONE_OFF',
        reason: text('Proposta a partir do lançamento', 'Proposal from time entry'),
      });
      onRevisionCreated(result.revision);
      await loadHistory();
      setMessage(
        text(
          'Revisão de estimativa criada. A confirmação humana permanece separada.',
          'Estimate revision created. Human confirmation stays separate.'
        )
      );
    } catch (err) {
      setError(extractApiError(err, text('Falha ao estimar', 'Unable to create estimate')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="tt-panel mt-4 space-y-4"
      aria-label={text('Estimativas', 'Estimates')}
      aria-busy={historyLoading}
    >
      <div>
        <h3 className="text-base font-semibold text-tt-text">
          {text('Estimativa e confirmação', 'Estimate and confirmation')}
        </h3>
        <p className="mt-1 text-xs text-tt-text-muted">
          {text(
            'Histórico de confirmações e revisões. Actual Tracked Duration só reflete sessões medidas.',
            'Confirmation and revision history. Actual Tracked Duration only reflects measured sessions.'
          )}
        </p>
      </div>

      {historyLoading ? (
        <p className="text-sm text-tt-text-muted" role="status">
          {text('Carregando histórico…', 'Loading history…')}
        </p>
      ) : null}
      {historyError ? <StateBanner tone="warning" message={historyError} /> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-tt border border-tt-border bg-tt-elevated p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-tt-text-muted">
            {text('Histórico de confirmações', 'Confirmation history')}
          </p>
          {confirmations.length > 0 ? (
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm text-tt-text">
              {confirmations.map((row) => (
                <li key={row.id} className="rounded-tt-control border border-tt-border bg-tt-surface p-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">v{row.version}</span>
                    <span className="font-mono tabular-nums">
                      {text('Duração confirmada', 'Confirmed Duration')}:{' '}
                      {formatMinutes(row.confirmedMinutes)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-tt-text-muted">
                    {new Date(row.confirmedAt).toLocaleString(locale === 'en' ? 'en' : 'pt-BR')} · #
                    {row.confirmedByUserId}
                  </p>
                  {row.estimatedMinutesSnapshot != null ? (
                    <p className="text-xs text-tt-text-muted">
                      {text('Duração estimada (snapshot)', 'Estimated Duration (snapshot)')}:{' '}
                      <span className="font-mono tabular-nums">
                        {formatMinutes(row.estimatedMinutesSnapshot)}
                      </span>
                    </p>
                  ) : null}
                  {row.justification ? (
                    <p className="mt-1 text-xs text-tt-text">{row.justification}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : confirmation?.confirmedMinutes != null || durations?.confirmedMinutes != null ? (
            <ul className="mt-2 space-y-1 text-sm text-tt-text">
              <li>
                <span className="text-tt-text-muted">
                  {text('Duração confirmada', 'Confirmed Duration')}:{' '}
                </span>
                <span className="font-mono tabular-nums">
                  {formatMinutes(
                    confirmation?.confirmedMinutes ?? durations?.confirmedMinutes ?? 0
                  )}
                </span>
              </li>
              {confirmation?.confirmedAt ? (
                <li>
                  <span className="text-tt-text-muted">{text('Em', 'At')}: </span>
                  {new Date(confirmation.confirmedAt).toLocaleString(
                    locale === 'en' ? 'en' : 'pt-BR'
                  )}
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-tt-text-muted">
              {text('Ainda sem confirmação registrada.', 'No confirmation recorded yet.')}
            </p>
          )}
        </div>

        <div className="rounded-tt border border-tt-border bg-tt-elevated p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-tt-text-muted">
            {text('Como foi estimado', 'How it was estimated')}
          </p>
          {explainRevision ? (
            <ul className="mt-2 space-y-1 text-sm text-tt-text">
              <li>
                {text('Base', 'Base')}:{' '}
                <span className="font-mono tabular-nums">
                  {formatMinutes(explainRevision.baseMinutes)}
                </span>
              </li>
              <li>
                {text('Fator', 'Factor')}:{' '}
                <span className="font-mono tabular-nums">{String(explainRevision.factor)}</span>
              </li>
              <li>
                {text('Duração estimada', 'Estimated Duration')}:{' '}
                <span className="font-mono tabular-nums">
                  {formatMinutes(explainRevision.suggestedMinutes)}
                </span>
              </li>
              {typeof (explainRevision as EstimateRevisionHistoryItem).formula === 'string' ? (
                <li className="font-mono text-xs text-tt-text-muted">
                  {(explainRevision as EstimateRevisionHistoryItem).formula}
                </li>
              ) : null}
              <li>
                {text('Origem', 'Origin')}: {explainRevision.origin} ·{' '}
                {explainRevision.algorithmVersion}
              </li>
              {explainRevision.parameterRevisionUuid ? (
                <li className="text-xs text-tt-text-muted">
                  {text('Parâmetro', 'Parameter')}: {explainRevision.parameterRevisionUuid}
                </li>
              ) : null}
            </ul>
          ) : durations?.estimatedMinutes != null ? (
            <p className="mt-2 text-sm text-tt-text">
              {text('Duração estimada', 'Estimated Duration')}:{' '}
              <span className="font-mono tabular-nums">
                {formatMinutes(durations.estimatedMinutes)}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-tt-text-muted">
              {text('Nenhuma revisão de estimativa disponível.', 'No estimate revision available.')}
            </p>
          )}

          {history && history.estimateRevisions.length > 1 ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-tt-link">
                {text('Revisões anteriores', 'Previous revisions')} (
                {history.estimateRevisions.length})
              </summary>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-tt-text-muted">
                {history.estimateRevisions.slice(1).map((rev) => (
                  <li key={rev.id}>
                    v{rev.version}: {rev.formula}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <p className="mt-3 text-xs text-tt-text-muted">
            {text('Duração medida', 'Actual Tracked Duration')}:{' '}
            <span className="font-mono tabular-nums text-tt-text">
              {history?.actualTrackedMinutes == null &&
              durations?.actualTrackedStatus === 'NOT_TRACKED'
                ? text('Não medido', 'Not tracked')
                : formatMinutes(
                    history?.actualTrackedMinutes ?? durations?.actualTrackedMinutes ?? 0
                  )}
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-tt border border-tt-border bg-tt-elevated p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-tt-text-muted">
          {text('Evidências (commit / PR / issue)', 'Evidence (commit / PR / issue)')}
        </p>
        <p className="mt-1 text-xs text-tt-text-muted">
          {text(
            'Contexto para estimativa. Nunca substitui Actual Tracked Duration.',
            'Context for estimates. Never substitutes Actual Tracked Duration.'
          )}
        </p>
        {references.length > 0 ? (
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm text-tt-text">
            {references.map((row) => (
              <li key={row.id} className="rounded-tt-control border border-tt-border bg-tt-surface p-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {row.kind} · {row.provider}
                  </span>
                  <span className="font-mono text-xs">{row.externalId}</span>
                </div>
                {row.repository ? (
                  <p className="text-xs text-tt-text-muted">{row.repository}</p>
                ) : null}
                {row.title ? <p className="text-xs text-tt-text">{row.title}</p> : null}
                {row.uri ? (
                  <a
                    className="text-xs text-tt-link underline"
                    href={row.uri}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.uri}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-tt-text-muted">
            {text('Nenhuma evidência vinculada.', 'No evidence linked yet.')}
          </p>
        )}
        {canPropose ? (
          <details className="mt-3">
            <summary className="min-h-touch cursor-pointer text-xs font-semibold text-tt-link">
              {text('Vincular evidência', 'Link evidence')}
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="workspace-label">
                {text('Tipo', 'Kind')}
                <select
                  className="workspace-input"
                  value={refKind}
                  onChange={(e) =>
                    setRefKind(e.target.value as typeof refKind)
                  }
                >
                  <option value="COMMIT">COMMIT</option>
                  <option value="PULL_REQUEST">PULL_REQUEST</option>
                  <option value="ISSUE">ISSUE</option>
                  <option value="DOCUMENT">DOCUMENT</option>
                  <option value="MANUAL">MANUAL</option>
                </select>
              </label>
              <label className="workspace-label">
                {text('Provedor', 'Provider')}
                <input
                  className="workspace-input"
                  value={refProvider}
                  onChange={(e) => setRefProvider(e.target.value)}
                  placeholder="github"
                />
              </label>
              <label className="workspace-label">
                {text('Identificador', 'External id')}
                <input
                  className="workspace-input font-mono"
                  value={refExternalId}
                  onChange={(e) => setRefExternalId(e.target.value)}
                  placeholder="sha / #42"
                />
              </label>
              <label className="workspace-label">
                {text('Repositório', 'Repository')}
                <input
                  className="workspace-input font-mono"
                  value={refRepository}
                  onChange={(e) => setRefRepository(e.target.value)}
                  placeholder="org/repo"
                />
              </label>
              <label className="workspace-label md:col-span-2">
                {text('Título', 'Title')}
                <input
                  className="workspace-input"
                  value={refTitle}
                  onChange={(e) => setRefTitle(e.target.value)}
                />
              </label>
              <label className="workspace-label md:col-span-2">
                URI
                <input
                  className="workspace-input font-mono"
                  value={refUri}
                  onChange={(e) => setRefUri(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="tt-btn-secondary mt-3"
              disabled={refBusy || !refExternalId.trim() || !refProvider.trim()}
              onClick={() => void linkReference()}
            >
              {refBusy
                ? text('Vinculando…', 'Linking…')
                : text('Vincular evidência', 'Link evidence')}
            </button>
            {refError ? <StateBanner tone="error" className="mt-2" message={refError} /> : null}
            {refMessage ? (
              <StateBanner tone="success" className="mt-2" message={refMessage} />
            ) : null}
          </details>
        ) : null}
        {canPropose ? (
          <details className="mt-3">
            <summary className="min-h-touch cursor-pointer text-xs font-semibold text-tt-link">
              {text('Commit local (git)', 'Local git commit')}
            </summary>
            <p className="mt-2 text-xs text-tt-text-muted">
              {text(
                'Cole SHA/assunto/caminho do repositório local. No desktop: node desktop/scripts/collect-local-git-reference.mjs. Sem host remoto.',
                'Paste local SHA/subject/repo path. On desktop: node desktop/scripts/collect-local-git-reference.mjs. No remote host.'
              )}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="workspace-label" htmlFor={`local-git-sha-${timeEntryId}`}>
                SHA
                <input
                  id={`local-git-sha-${timeEntryId}`}
                  className="workspace-input mt-1 font-mono"
                  value={localSha}
                  onChange={(e) => setLocalSha(e.target.value)}
                  placeholder="deadbeef…"
                  autoComplete="off"
                />
              </label>
              <label className="workspace-label" htmlFor={`local-git-repo-${timeEntryId}`}>
                {text('Repositório (caminho)', 'Repository (path)')}
                <input
                  id={`local-git-repo-${timeEntryId}`}
                  className="workspace-input mt-1 font-mono"
                  value={localRepo}
                  onChange={(e) => setLocalRepo(e.target.value)}
                  placeholder="C:/repos/app"
                  autoComplete="off"
                />
              </label>
              <label className="workspace-label md:col-span-2" htmlFor={`local-git-msg-${timeEntryId}`}>
                {text('Mensagem', 'Message')}
                <input
                  id={`local-git-msg-${timeEntryId}`}
                  className="workspace-input mt-1"
                  value={localMessage}
                  onChange={(e) => setLocalMessage(e.target.value)}
                />
              </label>
              <label className="workspace-label md:col-span-2" htmlFor={`local-git-author-${timeEntryId}`}>
                {text('E-mail do autor Git (opcional)', 'Git author email (optional)')}
                <input
                  id={`local-git-author-${timeEntryId}`}
                  className="workspace-input mt-1"
                  type="email"
                  value={localAuthorEmail}
                  onChange={(e) => setLocalAuthorEmail(e.target.value)}
                  placeholder="dev@example.com"
                  autoComplete="off"
                />
              </label>
            </div>
            <button
              type="button"
              className="tt-btn-secondary mt-3"
              disabled={localBusy || !localSha.trim()}
              onClick={() => void linkLocalGit()}
            >
              {localBusy
                ? text('Vinculando…', 'Linking…')
                : text('Vincular commit local', 'Link local commit')}
            </button>
            {localError ? <StateBanner tone="error" className="mt-2" message={localError} /> : null}
            {localSuccess ? (
              <StateBanner tone="success" className="mt-2" message={localSuccess} />
            ) : null}
          </details>
        ) : null}
      </div>

      {canConfirm && activityIdForConfirm != null ? (
        <details className="rounded-tt border border-tt-border p-3">
          <summary className="min-h-touch cursor-pointer font-semibold text-tt-text">
            {text(
              'Confirmar atividade (rateio multi-apontamento)',
              'Confirm activity (multi-entry split)'
            )}
          </summary>
          <p className="mt-2 text-xs text-tt-text-muted">
            {text(
              'Total confirmado é rateado só entre apontamentos que você pode confirmar (escopo estimates.confirm). Apontamentos de terceiros fora do escopo ficam de fora (confirmação parcial).',
              'Confirmed total is split only across entries you may confirm (estimates.confirm scope). Out-of-scope third-party entries are skipped (partial confirmation).'
            )}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="workspace-label" htmlFor="activity-confirm-total">
              {text('Total confirmado (min)', 'Confirmed total (min)')}
              <input
                id="activity-confirm-total"
                className="workspace-input mt-1 font-mono"
                value={activityTotal}
                onChange={(e) => {
                  setActivityTotal(e.target.value);
                  setActivityPreview(null);
                  setActivityPartialNotice(null);
                }}
              />
            </label>
            <label className="workspace-label" htmlFor="activity-confirm-justification">
              {text('Justificativa (opcional)', 'Justification (optional)')}
              <input
                id="activity-confirm-justification"
                className="workspace-input mt-1"
                value={activityJustification}
                onChange={(e) => setActivityJustification(e.target.value)}
                maxLength={2000}
              />
            </label>
          </div>
          {activityPreview ? (
            <div className="mt-3 space-y-2" aria-live="polite">
              {isActivityConfirmPartial(activityPreview) ? (
                <p
                  className="rounded-tt border border-tt-warning/40 bg-tt-warning-soft px-3 py-2 text-sm text-tt-text"
                  role="status"
                >
                  {text('Prévia parcial', 'Partial preview')}
                  {': '}
                  {text(
                    'rateio só nos confirmáveis; pulados',
                    'split only on confirmable entries; skipped'
                  )}{' '}
                  <span className="font-mono tabular-nums">
                    {formatSkippedEntryIdsLabel(
                      normalizeSkippedTimeEntryIds(activityPreview.skippedTimeEntryIds)
                    )}
                  </span>
                </p>
              ) : null}
              <ul className="space-y-1 text-sm text-tt-text">
                {activityPreview.distribution.map((row) => (
                  <li key={row.timeEntryId}>
                    #{row.timeEntryId}:{' '}
                    <span className="font-mono tabular-nums">
                      {formatMinutes(row.confirmedMinutes)}
                    </span>{' '}
                    <span className="text-xs text-tt-text-muted">
                      (v{row.confirmationVersion})
                    </span>
                  </li>
                ))}
              </ul>
              {normalizeSkippedTimeEntryIds(activityPreview.skippedTimeEntryIds).length > 0 ? (
                <p className="text-xs text-tt-text-muted">
                  {text('Apontamentos não alterados', 'Entries left unchanged')}:{' '}
                  <span className="font-mono">
                    {formatSkippedEntryIdsLabel(activityPreview.skippedTimeEntryIds ?? [])}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="tt-btn-secondary"
              disabled={activityBusy}
              onClick={() => void previewActivityConfirm()}
            >
              {activityBusy
                ? text('Calculando…', 'Calculating…')
                : text('Prévia do rateio', 'Preview split')}
            </button>
            <button
              type="button"
              className="tt-btn-primary"
              disabled={activityBusy}
              onClick={() => void confirmActivityDistributed()}
            >
              {activityBusy
                ? text('Confirmando…', 'Confirming…')
                : text('Confirmar atividade', 'Confirm activity')}
            </button>
          </div>
          {activityError ? (
            <StateBanner tone="error" className="mt-2" message={activityError} />
          ) : null}
          {activityMessage ? (
            <StateBanner tone="success" className="mt-2" message={activityMessage} />
          ) : null}
          {activityPartialNotice ? (
            <StateBanner tone="warning" className="mt-2" message={activityPartialNotice} />
          ) : null}
        </details>
      ) : null}

      {canPropose ? (
        <details className="rounded-tt border border-tt-border p-3">
          <summary className="min-h-touch cursor-pointer font-semibold text-tt-text">
            {text('Opções avançadas: criar estimativa', 'Advanced: create estimate')}
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="workspace-label">
              {text('Tipo de tarefa', 'Task type')}
              <select
                className="workspace-input"
                value={taskTypeCode}
                onChange={(e) => setTaskTypeCode(e.target.value)}
              >
                <option value="">{text('Manual (ONE_OFF)', 'Manual (ONE_OFF)')}</option>
                {taskTypes.map((row) => (
                  <option key={row.id} value={row.code}>
                    {locale === 'en' ? row.nameEn || row.code : row.namePt || row.code}
                  </option>
                ))}
              </select>
            </label>
            {!taskTypeCode ? (
              <>
                <label className="workspace-label">
                  {text('Base (min)', 'Base (min)')}
                  <input
                    className="workspace-input font-mono"
                    value={baseMinutes}
                    onChange={(e) => setBaseMinutes(e.target.value)}
                  />
                </label>
                <label className="workspace-label">
                  {text('Fator', 'Factor')}
                  <input
                    className="workspace-input font-mono"
                    value={factor}
                    onChange={(e) => setFactor(e.target.value)}
                  />
                </label>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="tt-btn-secondary mt-3"
            disabled={busy || !clientId}
            onClick={() => void createEstimate()}
          >
            {busy
              ? text('Criando...', 'Creating...')
              : text('Criar atividade + revisão', 'Create activity + revision')}
          </button>
        </details>
      ) : null}

      {error ? <StateBanner tone="error" message={error} /> : null}
      {message ? <StateBanner tone="success" message={message} /> : null}
    </section>
  );
};

export default EstimateExplainPanel;
