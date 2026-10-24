import React, { useEffect, useMemo, useState } from 'react';
import EmptyState from '../../../components/EmptyState';
import StateBanner from '../../../components/StateBanner';
import { getLocale, text } from '../../../i18n';
import api from '../../../services/api';
import { extractApiError } from '../../../utils/formatters';
import {
  conflictReasonMessage,
  eligibleEntryIdsFromPreview,
  formatClassifyResultSummary,
  toggleEntrySelection,
  type LegacyPreviewRow,
} from './legacyClassifyUi';

type PreviewEntry = LegacyPreviewRow & {
  userId: number;
  date: string;
  activityDescription: string;
  durationMinutes: number;
};

type Props = {
  projectId: number;
  projectLabel: string;
  canWrite: boolean;
};

const LegacyClassifyPanel: React.FC<Props> = ({ projectId, projectLabel, canWrite }) => {
  const [entries, setEntries] = useState<PreviewEntry[]>([]);
  const [totalWithoutProject, setTotalWithoutProject] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const locale = getLocale() === 'en' ? 'en' : 'pt';
  const eligibleIds = useMemo(() => eligibleEntryIdsFromPreview(entries), [entries]);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/projects/${projectId}/legacy-entries`, {
        params: { limit: 50 },
      });
      const data = response.data.data as {
        entries: PreviewEntry[];
        totalWithoutProject: number;
      };
      setEntries(data.entries || []);
      setTotalWithoutProject(data.totalWithoutProject || 0);
      setSelected(eligibleEntryIdsFromPreview(data.entries || []));
    } catch (err) {
      setError(
        extractApiError(
          err,
          text('Falha ao carregar legado sem projeto', 'Failed to load entries without project')
        )
      );
      setEntries([]);
      setSelected([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMessage(null);
    void load();
  }, [projectId]);

  const runClassify = async (dryRun: boolean) => {
    if (!canWrite || selected.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await api.post(`/api/projects/${projectId}/classify-legacy-entries`, {
        entryIds: selected,
        dryRun,
      });
      const result = response.data.data as {
        assignedIds: number[];
        conflicts: Array<{ entryId: number; reason: string }>;
        dryRun: boolean;
      };
      setMessage(formatClassifyResultSummary(result, locale));
      if (!dryRun) await load();
    } catch (err) {
      setError(
        extractApiError(
          err,
          text('Falha ao classificar legado', 'Failed to classify legacy entries')
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="workspace-panel mb-6 p-4"
      aria-labelledby="legacy-classify-heading"
    >
      <h3 id="legacy-classify-heading" className="text-base font-semibold text-tt-text">
        {text('Classificar legado sem projeto', 'Classify legacy “no project”')}
      </h3>
      <p className="mt-1 text-sm text-tt-text-muted">
        {text(
          `Atribuir o projeto ${projectLabel} a lançamentos deste cliente que ainda estão sem projeto. Períodos fechados permanecem em conflito.`,
          `Assign project ${projectLabel} to this client’s entries that still have no project. Closed periods stay as conflicts.`
        )}
      </p>

      {error ? <StateBanner tone="error" className="mt-3" message={error} /> : null}
      {message ? <StateBanner tone="success" className="mt-3" message={message} /> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="tt-btn-secondary min-h-touch"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          {text('Atualizar prévia', 'Refresh preview')}
        </button>
        {canWrite ? (
          <>
            <button
              type="button"
              className="tt-btn-secondary min-h-touch"
              onClick={() => void runClassify(true)}
              disabled={busy || selected.length === 0}
            >
              {text('Prévia (dry-run)', 'Preview (dry-run)')}
            </button>
            <button
              type="button"
              className="tt-btn-primary min-h-touch"
              onClick={() => void runClassify(false)}
              disabled={busy || selected.length === 0}
            >
              {text('Atribuir selecionados', 'Assign selected')}
            </button>
          </>
        ) : null}
        {eligibleIds.length > 0 ? (
          <button
            type="button"
            className="tt-btn-secondary min-h-touch"
            onClick={() => setSelected(eligibleIds)}
          >
            {text('Selecionar elegíveis', 'Select eligible')}
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-tt-text-muted" aria-live="polite">
        {text(
          `${totalWithoutProject} sem projeto no cliente · ${selected.length} selecionado(s)`,
          `${totalWithoutProject} without project on client · ${selected.length} selected`
        )}
      </p>

      {loading ? (
        <StateBanner
          tone="info"
          className="mt-3"
          message={text('Carregando prévia...', 'Loading preview...')}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          className="mt-3"
          title={text('Nenhum legado sem projeto', 'No legacy without project')}
          description={text(
            'Todos os lançamentos deste cliente já têm projeto ou não há registros.',
            'All entries for this client already have a project, or there are none.'
          )}
        />
      ) : (
        <div className="tt-table-scroll mt-3">
          <table className="tt-table">
            <caption className="sr-only">
              {text(
                'Prévia de lançamentos sem projeto com decisões de classificação',
                'Preview of entries without project and classify decisions'
              )}
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{text('Selecionar', 'Select')}</span>
                </th>
                <th scope="col">{text('Data', 'Date')}</th>
                <th scope="col">{text('Atividade', 'Activity')}</th>
                <th scope="col">{text('Min', 'Min')}</th>
                <th scope="col">{text('Decisão', 'Decision')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const eligible = entry.decision === 'eligible';
                const checkboxId = `legacy-entry-${entry.id}`;
                return (
                  <tr key={entry.id}>
                    <td>
                      <label htmlFor={checkboxId} className="flex min-h-touch items-center">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selected.includes(entry.id)}
                          disabled={!eligible || !canWrite}
                          onChange={() =>
                            setSelected((prev) => toggleEntrySelection(prev, entry.id))
                          }
                        />
                        <span className="sr-only">#{entry.id}</span>
                      </label>
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {String(entry.date).slice(0, 10)}
                    </td>
                    <td className="max-w-xs truncate text-sm" title={entry.activityDescription}>
                      {entry.activityDescription}
                    </td>
                    <td className="text-sm">{entry.durationMinutes}</td>
                    <td className="text-sm">
                      {eligible
                        ? text('Elegível', 'Eligible')
                        : conflictReasonMessage(String(entry.decision), locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default LegacyClassifyPanel;
