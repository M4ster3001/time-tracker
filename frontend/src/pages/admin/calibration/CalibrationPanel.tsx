import React, { useEffect, useState } from 'react';
import EmptyState from '../../../components/EmptyState';
import StateBanner from '../../../components/StateBanner';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import { text } from '../../../i18n';
import api from '../../../services/api';
import { extractApiError } from '../../../utils/formatters';
import {
  fetchTaskTypes,
  type TaskTypeRow,
} from '../../consultant/time-entry/services/estimates.service';

type Comparison = {
  sampleSize: number;
  estimatedVsConfirmed: {
    sampleSize: number;
    medianAbsoluteErrorMinutes: number | null;
    biasMinutes: number | null;
  };
  estimatedVsMeasured: {
    sampleSize: number;
    medianAbsoluteErrorMinutes: number | null;
    biasMinutes: number | null;
  };
  rowsExcludedForMissingMeasured: number;
};

type ThresholdDraft = {
  minSampleSize: string;
  minMeasuredSampleSize: string;
  maxMedianAbsoluteErrorMinutes: string;
  maxAbsoluteBiasMinutes: string;
};

const emptyThresholdDraft = (): ThresholdDraft => ({
  minSampleSize: '',
  minMeasuredSampleSize: '',
  maxMedianAbsoluteErrorMinutes: '',
  maxAbsoluteBiasMinutes: '',
});

const optionalNumber = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
};

const CalibrationPanel: React.FC = () => {
  const { capabilities, can } = useCapabilities();
  const estimatesOn = Boolean(capabilities?.flows?.estimates);
  const canManage =
    can('estimation_parameters.manage', 'all') || can('estimation_parameters.manage');
  const canRead = can('estimates.read');

  const [taskTypes, setTaskTypes] = useState<TaskTypeRow[]>([]);
  const [taskTypeCode, setTaskTypeCode] = useState('');
  const [parameterSetId, setParameterSetId] = useState('');
  const [targetClientId, setTargetClientId] = useState('');
  const [targetProjectId, setTargetProjectId] = useState('');
  const [parameterSets, setParameterSets] = useState<
    Array<{ id: number; scope: string; clientId: number | null; projectId: number | null }>
  >([]);
  const [proposedBase, setProposedBase] = useState('60');
  const [proposedFactor, setProposedFactor] = useState('1');
  const [justification, setJustification] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [proposalId, setProposalId] = useState<number | null>(null);
  const [proposalUuid, setProposalUuid] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdDraft>(emptyThresholdDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!estimatesOn || !canRead) return;
    const controller = new AbortController();
    void fetchTaskTypes()
      .then((rows) => {
        if (!controller.signal.aborted) setTaskTypes(rows);
      })
      .catch(() => {
        if (!controller.signal.aborted) setTaskTypes([]);
      });
    void api
      .get('/api/estimates/calibration/policy', { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const row = response.data.data?.thresholds as {
          minSampleSize: number | null;
          minMeasuredSampleSize: number | null;
          maxMedianAbsoluteErrorMinutes: number | null;
          maxAbsoluteBiasMinutes: number | null;
        };
        if (!row) return;
        setThresholds({
          minSampleSize: row.minSampleSize == null ? '' : String(row.minSampleSize),
          minMeasuredSampleSize:
            row.minMeasuredSampleSize == null ? '' : String(row.minMeasuredSampleSize),
          maxMedianAbsoluteErrorMinutes:
            row.maxMedianAbsoluteErrorMinutes == null
              ? ''
              : String(row.maxMedianAbsoluteErrorMinutes),
          maxAbsoluteBiasMinutes:
            row.maxAbsoluteBiasMinutes == null ? '' : String(row.maxAbsoluteBiasMinutes),
        });
      })
      .catch(() => {
        /* policy endpoint may be unavailable until migration */
      });
    return () => controller.abort();
  }, [estimatesOn, canRead]);

  useEffect(() => {
    const selected = taskTypes.find((row) => row.code === taskTypeCode);
    if (!selected) {
      setParameterSets([]);
      setParameterSetId('');
      return;
    }
    const controller = new AbortController();
    void api
      .get(`/api/task-types/${selected.id}/parameter-sets`, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const rows = (response.data.data || []) as Array<{
          id: number;
          scope: string;
          clientId: number | null;
          projectId: number | null;
          isActive?: boolean;
        }>;
        setParameterSets(rows.filter((row) => row.isActive !== false));
      })
      .catch(() => {
        if (!controller.signal.aborted) setParameterSets([]);
      });
    return () => controller.abort();
  }, [taskTypeCode, taskTypes]);

  if (!estimatesOn) {
    return (
      <section className="tt-panel">
        <p className="text-tt-text-muted">
          {text('O fluxo de estimativas está desligado.', 'The estimates flow is turned off.')}
        </p>
      </section>
    );
  }

  if (!canRead || !canManage) {
    return (
      <section className="tt-panel">
        <p className="text-tt-text-muted">
          {text(
            'É necessário estimates.read e estimation_parameters.manage.',
            'estimates.read and estimation_parameters.manage are required.'
          )}
        </p>
      </section>
    );
  }

  const preview = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await api.post('/api/estimates/calibration/preview', {
        taskTypeCode: taskTypeCode || null,
        parameterSetId: optionalNumber(parameterSetId),
        targetClientId: optionalNumber(targetClientId),
        targetProjectId: optionalNumber(targetProjectId),
        proposedBaseMinutes: Number(proposedBase),
        proposedFactor: Number(proposedFactor),
        justification: justification || undefined,
        persistDraft: true,
        markProposed: true,
      });
      const data = response.data.data as {
        comparison: Comparison;
        proposalId: number | null;
        proposalUuid: string | null;
      };
      setComparison(data.comparison);
      setProposalId(data.proposalId);
      setProposalUuid(data.proposalUuid);
      setMessage(
        text(
          'Prévia gerada e proposta persistida para decisão.',
          'Preview generated and proposal persisted for decision.'
        )
      );
    } catch (err) {
      setError(extractApiError(err, text('Falha na prévia', 'Preview failed')));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    if (proposalId == null) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/api/estimates/calibration/${proposalId}/decide`, {
        decision,
        justification: justification || undefined,
      });
      setMessage(
        decision === 'APPROVE'
          ? text('Proposta aprovada.', 'Proposal approved.')
          : text('Proposta rejeitada.', 'Proposal rejected.')
      );
    } catch (err) {
      setError(extractApiError(err, text('Falha ao decidir', 'Decision failed')));
    } finally {
      setBusy(false);
    }
  };

  const savePolicy = async () => {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.put('/api/estimates/calibration/policy', {
        thresholds: {
          minSampleSize: optionalNumber(thresholds.minSampleSize),
          minMeasuredSampleSize: optionalNumber(thresholds.minMeasuredSampleSize),
          maxMedianAbsoluteErrorMinutes: optionalNumber(
            thresholds.maxMedianAbsoluteErrorMinutes
          ),
          maxAbsoluteBiasMinutes: optionalNumber(thresholds.maxAbsoluteBiasMinutes),
        },
      });
      setMessage(
        text(
          'Limiares salvos. Campos vazios permanecem sem gate (produto define números do piloto).',
          'Thresholds saved. Empty fields stay ungated (product sets pilot numbers).'
        )
      );
    } catch (err) {
      setError(extractApiError(err, text('Falha ao salvar limiares', 'Failed to save thresholds')));
    } finally {
      setBusy(false);
    }
  };

  const metric = (label: string, value: number | null) => (
    <div>
      <p className="text-xs text-tt-text-muted">{label}</p>
      <p className="font-mono text-sm tabular-nums text-tt-text">
        {value == null ? '—' : value.toFixed(2)}
      </p>
    </div>
  );

  return (
    <section className="tt-panel space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-tt-text">
          {text('Calibração de estimativas', 'Estimate calibration')}
        </h3>
        <p className="mt-1 text-sm text-tt-text-muted">
          {text(
            'Compara Duração estimada × confirmada (e medida quando existir). Não inventa Actual Tracked.',
            'Compares Estimated × Confirmed Duration (and Actual Tracked when present). Never invents Actual Tracked.'
          )}
        </p>
      </div>

      {taskTypes.length === 0 ? (
        <EmptyState
          variant="no-data"
          title={text('Nenhum tipo de tarefa no catálogo', 'No task types in the catalog')}
          description={text(
            'Cadastre tipos em Configurações → Tipos de tarefa. A amostra global ainda pode ser usada.',
            'Add types under Settings → Task types. The global sample can still be used.'
          )}
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm" htmlFor="cal-task-type">
          <span className="mb-1 block font-medium text-tt-text">
            {text('Tipo de tarefa', 'Task type')}
          </span>
          <select
            id="cal-task-type"
            className="workspace-input w-full min-h-touch"
            value={taskTypeCode}
            onChange={(e) => {
              setTaskTypeCode(e.target.value);
              setParameterSetId('');
            }}
          >
            <option value="">{text('Qualquer / amostra global', 'Any / global sample')}</option>
            {taskTypes.map((row) => (
              <option key={row.id} value={row.code}>
                {row.code}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm" htmlFor="cal-parameter-set">
          <span className="mb-1 block font-medium text-tt-text">
            {text('Set de parâmetros (opcional)', 'Parameter set (optional)')}
          </span>
          <select
            id="cal-parameter-set"
            className="workspace-input w-full min-h-touch"
            value={parameterSetId}
            onChange={(e) => setParameterSetId(e.target.value)}
            disabled={!taskTypeCode || parameterSets.length === 0}
          >
            <option value="">
              {text(
                'Precedência por cliente/projeto → GLOBAL',
                'Precedence by client/project → GLOBAL'
              )}
            </option>
            {parameterSets.map((set) => (
              <option key={set.id} value={String(set.id)}>
                #{set.id} · {set.scope}
                {set.clientId != null ? ` · client ${set.clientId}` : ''}
                {set.projectId != null ? ` · project ${set.projectId}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm" htmlFor="cal-target-client">
          <span className="mb-1 block font-medium text-tt-text">
            {text('Cliente alvo (precedência)', 'Target client (precedence)')}
          </span>
          <input
            id="cal-target-client"
            className="workspace-input w-full min-h-touch font-mono"
            inputMode="numeric"
            value={targetClientId}
            onChange={(e) => setTargetClientId(e.target.value)}
            placeholder={text('vazio = só GLOBAL', 'empty = GLOBAL only')}
            disabled={Boolean(parameterSetId)}
          />
        </label>
        <label className="block text-sm" htmlFor="cal-target-project">
          <span className="mb-1 block font-medium text-tt-text">
            {text('Projeto alvo (precedência)', 'Target project (precedence)')}
          </span>
          <input
            id="cal-target-project"
            className="workspace-input w-full min-h-touch font-mono"
            inputMode="numeric"
            value={targetProjectId}
            onChange={(e) => setTargetProjectId(e.target.value)}
            placeholder={text('opcional', 'optional')}
            disabled={Boolean(parameterSetId)}
          />
        </label>
        <label className="block text-sm" htmlFor="cal-justification">
          <span className="mb-1 block font-medium text-tt-text">
            {text('Justificativa', 'Justification')}
          </span>
          <input
            id="cal-justification"
            className="workspace-input w-full min-h-touch"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </label>
        <label className="block text-sm" htmlFor="cal-proposed-base">
          <span className="mb-1 block font-medium text-tt-text">
            {text('Base proposta (min)', 'Proposed base (min)')}
          </span>
          <input
            id="cal-proposed-base"
            className="workspace-input w-full min-h-touch font-mono"
            value={proposedBase}
            onChange={(e) => setProposedBase(e.target.value)}
          />
        </label>
        <label className="block text-sm" htmlFor="cal-proposed-factor">
          <span className="mb-1 block font-medium text-tt-text">
            {text('Fator proposto', 'Proposed factor')}
          </span>
          <input
            id="cal-proposed-factor"
            className="workspace-input w-full min-h-touch font-mono"
            value={proposedFactor}
            onChange={(e) => setProposedFactor(e.target.value)}
          />
        </label>
      </div>

      <button
        type="button"
        className="tt-btn-primary min-h-touch"
        disabled={busy}
        onClick={() => void preview()}
      >
        {busy
          ? text('Calculando...', 'Computing...')
          : text('Prévia + rascunho', 'Preview + draft')}
      </button>

      {comparison ? (
        <div
          className="grid gap-3 rounded-tt border border-tt-border bg-tt-elevated p-4 md:grid-cols-3"
          role="region"
          aria-live="polite"
          aria-label={text('Resultado da prévia', 'Preview results')}
        >
          <div>
            <p className="text-xs text-tt-text-muted">{text('Amostra', 'Sample')}</p>
            <p className="font-mono text-lg tabular-nums">{comparison.sampleSize}</p>
          </div>
          {metric(
            text('Erro mediano est.×conf.', 'Median abs err est.×conf.'),
            comparison.estimatedVsConfirmed.medianAbsoluteErrorMinutes
          )}
          {metric(
            text('Viés est.×conf.', 'Bias est.×conf.'),
            comparison.estimatedVsConfirmed.biasMinutes
          )}
          {metric(
            text('Erro mediano est.×medida', 'Median abs err est.×tracked'),
            comparison.estimatedVsMeasured.medianAbsoluteErrorMinutes
          )}
          <div>
            <p className="text-xs text-tt-text-muted">
              {text('Sem medição (excluídos)', 'Not tracked (excluded)')}
            </p>
            <p className="font-mono text-sm tabular-nums">
              {comparison.rowsExcludedForMissingMeasured}
            </p>
          </div>
          {proposalUuid ? (
            <div className="md:col-span-3 text-xs text-tt-text-muted">
              {text('Proposta', 'Proposal')}: #{proposalId} · {proposalUuid}
            </div>
          ) : null}
        </div>
      ) : null}

      {proposalId != null ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="tt-btn-primary min-h-touch"
            disabled={busy}
            onClick={() => void decide('APPROVE')}
          >
            {text('Aprovar', 'Approve')}
          </button>
          <button
            type="button"
            className="tt-btn-secondary min-h-touch"
            disabled={busy}
            onClick={() => void decide('REJECT')}
          >
            {text('Rejeitar', 'Reject')}
          </button>
        </div>
      ) : null}

      <div className="space-y-3 rounded-tt border border-tt-border bg-tt-elevated p-4">
        <div>
          <h4 className="text-sm font-semibold text-tt-text">
            {text('Limiares de promoção (CAL-01)', 'Promotion thresholds (CAL-01)')}
          </h4>
          <p className="mt-1 text-xs text-tt-text-muted">
            {text(
              'Vazio = gate desligado. Não invente números de piloto aqui — preencha só após decisão de produto (§4.3).',
              'Empty = gate off. Do not invent pilot numbers here — fill only after a product decision (§4.3).'
            )}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="workspace-label">
            {text('Amostra mínima', 'Min sample size')}
            <input
              className="workspace-input font-mono"
              inputMode="numeric"
              value={thresholds.minSampleSize}
              onChange={(e) =>
                setThresholds((prev) => ({ ...prev, minSampleSize: e.target.value }))
              }
              placeholder={text('não definido', 'unset')}
            />
          </label>
          <label className="workspace-label">
            {text('Amostra mínima medida', 'Min measured sample')}
            <input
              className="workspace-input font-mono"
              inputMode="numeric"
              value={thresholds.minMeasuredSampleSize}
              onChange={(e) =>
                setThresholds((prev) => ({ ...prev, minMeasuredSampleSize: e.target.value }))
              }
              placeholder={text('não definido', 'unset')}
            />
          </label>
          <label className="workspace-label">
            {text('Erro mediano máx. (min)', 'Max median abs error (min)')}
            <input
              className="workspace-input font-mono"
              inputMode="decimal"
              value={thresholds.maxMedianAbsoluteErrorMinutes}
              onChange={(e) =>
                setThresholds((prev) => ({
                  ...prev,
                  maxMedianAbsoluteErrorMinutes: e.target.value,
                }))
              }
              placeholder={text('não definido', 'unset')}
            />
          </label>
          <label className="workspace-label">
            {text('|Viés| máx. (min)', 'Max |bias| (min)')}
            <input
              className="workspace-input font-mono"
              inputMode="decimal"
              value={thresholds.maxAbsoluteBiasMinutes}
              onChange={(e) =>
                setThresholds((prev) => ({ ...prev, maxAbsoluteBiasMinutes: e.target.value }))
              }
              placeholder={text('não definido', 'unset')}
            />
          </label>
        </div>
        {canManage ? (
          <button
            type="button"
            className="tt-btn-secondary min-h-touch"
            disabled={busy}
            onClick={() => void savePolicy()}
          >
            {text('Salvar limiares', 'Save thresholds')}
          </button>
        ) : null}
      </div>

      {error ? <StateBanner tone="error" message={error} /> : null}
      {message ? <StateBanner tone="success" message={message} /> : null}
    </section>
  );
};

export default CalibrationPanel;
