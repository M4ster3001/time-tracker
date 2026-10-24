import { useEffect, useState, type KeyboardEvent } from 'react';
import AppShell from '../../../components/AppShell';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import { onTablistKeyDown } from '../../../hooks/tablistKeyboard';
import api from '../../../services/api';
import { getLocale, text, useLocale } from '../../../i18n';
import {
  extractApiError,
  formatCurrency,
  formatDate,
  formatMinutes,
  monthOptions,
} from '../../../utils/formatters';

type Policy = {
  clientAccountId: number | null;
  consume: 'WORKED' | 'BILLABLE';
  individualBank: boolean;
};
type Line = {
  userId: number;
  name: string;
  workedMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
  billableMinutes: number;
  billableAmount?: number | null;
  issues: string[];
};
type Snapshot = {
  clientName: string;
  startDate: string;
  endDate: string;
  lines: Line[];
  policy: Policy;
};
type Revision = {
  version: number;
  reason: string;
  createdAt: string;
  approvedAt: string | null;
  createdBy: number;
};
type Workspace = {
  period: { id: number | null; state: string; version: number; publishedVersion: number };
  preview: Snapshot;
  published: Snapshot | null;
  needsRecalculation: boolean;
  revisions: Revision[];
};
type Options = {
  clients: Array<{ id: number; name: string }>;
  accounts: Array<{ id: number; clientId: number; name: string }>;
};
const initialPolicy: Policy = { clientAccountId: null, consume: 'BILLABLE', individualBank: false };

export default function ClosingPage() {
  useLocale();
  const { can, capabilities } = useCapabilities();
  const [options, setOptions] = useState<Options>({ clients: [], accounts: [] });
  const [clientId, setClientId] = useState('');
  const [year, setYear] = useState(
    new Date().getFullYear() - (new Date().getMonth() === 0 ? 1 : 0)
  );
  const [month, setMonth] = useState(new Date().getMonth() || 12);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [policy, setPolicy] = useState<Policy>(initialPolicy);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'preview' | 'published' | 'history'>('preview');
  useEffect(() => {
    void api
      .get('/api/closing-periods/options')
      .then((response) => {
        setOptions(response.data.data);
        setClientId(String(response.data.data.clients[0]?.id ?? ''));
      })
      .catch((err) =>
        setError(
          extractApiError(err, text('Falha ao carregar clientes.', 'Unable to load clients.'))
        )
      );
  }, []);
  useEffect(() => {
    let active = true;
    setWorkspace(null);
    setError('');
    setMessage('');
    if (!clientId) return;
    setLoading(true);
    void api
      .get('/api/closing-periods', { params: { clientId, year, month } })
      .then((response) => {
        if (active) {
          setWorkspace(response.data.data);
          setPolicy(response.data.data.preview.policy);
        }
      })
      .catch((err) => {
        if (active)
          setError(
            extractApiError(
              err,
              text('Falha ao carregar fechamento.', 'Unable to load month close.')
            )
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId, year, month]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      const data = (await api.get('/api/closing-periods', { params: { clientId, year, month } }))
        .data.data;
      setWorkspace(data);
      setPolicy(data.preview.policy);
      setReason('');
      setMessage(text('Fechamento atualizado.', 'Month close updated.'));
    } catch (err) {
      setError(
        extractApiError(
          err,
          text('Não foi possível concluir a operação.', 'Unable to complete the operation.')
        )
      );
    } finally {
      setBusy(false);
    }
  };
  const exportRevision = async (version?: number) => {
    const response = await api.get('/api/closing-periods/export', {
      params: { clientId, year, month, version, locale: getLocale() },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data),
      link = document.createElement('a');
    link.href = url;
    link.download = `closing-${clientId}-${year}-${month}-v${version ?? workspace?.period.publishedVersion}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const ready = !busy && !loading && Boolean(workspace) && Boolean(capabilities?.flows.closing);
  const hasPublished = Boolean(workspace?.period.publishedVersion);
  const snapshot = tab === 'published' ? workspace?.published : workspace?.preview;
  const issues = workspace?.preview.lines.some((line) => line.issues.length);
  const canExport = can('reports.export', 'all') && can('rates.read', 'all');
  const submit = () =>
    api.post(`/api/closing-periods/${hasPublished ? 'recalculate' : 'submit'}`, {
      clientId: Number(clientId),
      year,
      month,
      expectedVersion: workspace?.period.version,
      policy,
      reason,
    });
  return (
    <AppShell
      title={text('Fechamento mensal', 'Month close')}
      subtitle={text(
        'Confira o ciclo encerrado, resolva pendências e aprove uma versão rastreável.',
        'Review the completed service cycle, resolve issues and approve a traceable revision.'
      )}
    >
      <section className="workspace-panel grid gap-4 sm:grid-cols-3">
        <label className="workspace-label">
          {text('Cliente', 'Client')}
          <select
            className="workspace-input"
            value={clientId}
            disabled={busy}
            onChange={(event) => setClientId(event.target.value)}
          >
            <option value="">{text('Selecione', 'Select')}</option>
            {options.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="workspace-label">
          {text('Ano', 'Year')}
          <input
            className="workspace-input"
            type="number"
            min={2000}
            max={2100}
            value={year}
            disabled={busy}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </label>
        <label className="workspace-label">
          {text('Mês de encerramento', 'Cycle ending month')}
          <select
            className="workspace-input"
            value={month}
            disabled={busy}
            onChange={(event) => setMonth(Number(event.target.value))}
          >
            {monthOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </section>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="workspace-success">
          {message}
        </p>
      )}
      {loading && (
        <p role="status">
          {text('Conferindo horas e alocações...', 'Checking time entries and allocations...')}
        </p>
      )}
      {workspace && (
        <>
          <section className="workspace-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{workspace.preview.clientName}</h3>
                <p className="mt-1 text-sm">
                  {formatDate(workspace.preview.startDate)} —{' '}
                  {formatDate(workspace.preview.endDate)}
                </p>
              </div>
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  workspace.period.state === 'CLOSED'
                    ? 'bg-tt-success-soft text-tt-success'
                    : workspace.period.state === 'REVIEW'
                      ? 'bg-tt-warning-soft text-tt-warning'
                      : 'bg-tt-elevated text-tt-text'
                }`}
              >
                {
                  {
                    DRAFT: text('Rascunho', 'Draft'),
                    REVIEW: text('Em conferência', 'In review'),
                    CLOSED: text('Aprovado', 'Approved'),
                  }[workspace.period.state]
                }{' '}
                · v{workspace.period.version}
              </span>
            </div>
            {workspace.needsRecalculation && (
              <p className="tt-banner-warning mt-4">
                {text(
                  'Há alterações após a aprovação. A versão publicada permanece preservada. Libere o período e gere um recálculo para conferência.',
                  'Data changed after approval. The published revision is preserved. Unlock the period and generate a recalculation for review.'
                )}
              </p>
            )}
            {issues && (
              <p className="workspace-error mt-4">
                {text(
                  'Resolva as tarifas e alocações pendentes antes de enviar o fechamento.',
                  'Resolve missing historical rates and allocations before submitting.'
                )}
              </p>
            )}
          </section>
          <div
            className="workspace-tabs"
            role="tablist"
            aria-label={text('Etapas do fechamento', 'Month-close stages')}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              const tabs = ['preview', 'published', 'history'] as const;
              onTablistKeyDown(event, {
                selectedIndex: tabs.indexOf(tab),
                length: tabs.length,
                selectIndex: (index) => {
                  const next = tabs[index];
                  if (!next) return;
                  setTab(next);
                  window.requestAnimationFrame(() => {
                    document.getElementById(`closing-tab-${next}`)?.focus();
                  });
                },
              });
            }}
          >
            {(['preview', 'published', 'history'] as const).map((value) => (
              <button
                key={value}
                id={`closing-tab-${value}`}
                type="button"
                className={`workspace-tab ${tab === value ? 'active' : ''}`}
                role="tab"
                aria-selected={tab === value}
                aria-controls={`closing-panel-${value}`}
                tabIndex={tab === value ? 0 : -1}
                onClick={() => setTab(value)}
              >
                {value === 'preview'
                  ? text('Conferência atual', 'Current review')
                  : value === 'published'
                    ? text('Versão publicada', 'Published revision')
                    : text('Histórico de versões', 'Revision history')}
              </button>
            ))}
          </div>
          {tab !== 'history' && (
            <section
              id={`closing-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`closing-tab-${tab}`}
              className="workspace-panel"
            >
              {snapshot ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          {[
                            text('Pessoa', 'Person'),
                            text('Trabalhadas', 'Worked'),
                            text('Meta', 'Target'),
                            text('Extras', 'Overtime'),
                            text('Faturáveis', 'Billable'),
                            ...(can('rates.read', 'all') ? [text('Valor', 'Amount')] : []),
                            text('Pendências', 'Issues'),
                          ].map((label) => (
                            <th key={label} scope="col" className="p-3">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.lines.map((line) => (
                          <tr key={line.userId} className="border-t border-tt-border">
                            <td className="p-3">{line.name}</td>
                            {[
                              line.workedMinutes,
                              line.targetMinutes,
                              line.overtimeMinutes,
                              line.billableMinutes,
                            ].map((minutes, index) => (
                              <td key={index} className="p-3 whitespace-nowrap tabular-nums">
                                {formatMinutes(minutes)}
                              </td>
                            ))}
                            {can('rates.read', 'all') && (
                              <td className="p-3 whitespace-nowrap">
                                {line.billableAmount == null
                                  ? '—'
                                  : formatCurrency(line.billableAmount)}
                              </td>
                            )}
                            <td className="p-3">
                              {line.issues
                                .map((issue) =>
                                  issue === 'MISSING_RATE'
                                    ? text('Tarifa histórica ausente', 'Missing historical rate')
                                    : text('Alocação ausente', 'Missing allocation')
                                )
                                .join(', ') || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!snapshot.lines.length && (
                    <p className="py-5 text-tt-text-muted">
                      {text(
                        'Nenhuma atividade ou alocação no ciclo.',
                        'No activity or allocation in this cycle.'
                      )}
                    </p>
                  )}
                  {tab === 'published' && canExport && (
                    <button
                      className="workspace-secondary mt-4"
                      disabled={busy}
                      onClick={() => {
                        void run(() => exportRevision());
                      }}
                    >
                      {text('Exportar versão aprovada (XLSX)', 'Export approved revision (XLSX)')}
                    </button>
                  )}
                </>
              ) : (
                <p>{text('Nenhuma versão aprovada.', 'No approved revision yet.')}</p>
              )}
            </section>
          )}
          {tab === 'history' && (
            <section
              id="closing-panel-history"
              role="tabpanel"
              aria-labelledby="closing-tab-history"
              className="workspace-panel space-y-4"
            >
              {workspace.revisions.map((revision) => (
                <article key={revision.version} className="border-b border-tt-border pb-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <p className="font-semibold">
                      v{revision.version} · {formatDate(revision.createdAt)} ·{' '}
                      {revision.approvedAt
                        ? text('Aprovada', 'Approved')
                        : text('Não aprovada', 'Unapproved')}
                    </p>
                    {revision.approvedAt && canExport && (
                      <button
                        className="workspace-secondary"
                        disabled={busy}
                        onClick={() => {
                          void run(() => exportRevision(revision.version));
                        }}
                      >
                        {text('Exportar', 'Export')}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{revision.reason}</p>
                </article>
              ))}
              {!workspace.revisions.length && (
                <p>{text('Nenhuma revisão registrada.', 'No revisions recorded.')}</p>
              )}
            </section>
          )}
          {(can('closing.submit', 'all') ||
            can('closing.recalculate', 'all') ||
            can('closing.approve', 'all')) && (
            <section className="workspace-panel space-y-4">
              <h3 className="text-lg font-semibold">
                {text('Regras e aprovação', 'Rules and approval')}
              </h3>
              <p className="text-sm text-tt-text-muted">
                {text(
                  'A meta usa dias úteis e alocações. A compensação individual é opcional; as regras acordadas devem ser conferidas antes de habilitá-la.',
                  'Targets use weekdays and allocations. Personal compensation is optional; review agreed rules before enabling it.'
                )}
              </p>
              <fieldset
                disabled={hasPublished || busy || !can('balances.write', 'all')}
                className="grid gap-4 sm:grid-cols-2 disabled:opacity-70"
              >
                <label className="workspace-label">
                  {text('Bolsão a consumir', 'Pool to consume')}
                  <select
                    className="workspace-input"
                    value={policy.clientAccountId ?? ''}
                    onChange={(event) =>
                      setPolicy({ ...policy, clientAccountId: Number(event.target.value) || null })
                    }
                  >
                    <option value="">
                      {text('Sem movimentação de bolsão', 'No pool movement')}
                    </option>
                    {options.accounts
                      .filter((account) => account.clientId === Number(clientId))
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="workspace-label">
                  {text('Base do consumo', 'Consumption basis')}
                  <select
                    className="workspace-input"
                    value={policy.consume}
                    onChange={(event) =>
                      setPolicy({ ...policy, consume: event.target.value as Policy['consume'] })
                    }
                  >
                    <option value="BILLABLE">
                      {text('Minutos faturáveis', 'Billable minutes')}
                    </option>
                    <option value="WORKED">{text('Minutos trabalhados', 'Worked minutes')}</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={policy.individualBank}
                    onChange={(event) =>
                      setPolicy({ ...policy, individualBank: event.target.checked })
                    }
                  />
                  {text(
                    'Lançar diferença trabalhadas − meta no banco individual',
                    'Post worked − target difference to personal banks'
                  )}
                </label>
              </fieldset>
              {hasPublished && (
                <p className="text-sm">
                  {text(
                    'As regras de saldo ficam fixas após a primeira aprovação. Recálculos registram somente a diferença.',
                    'Balance rules are fixed after the first approval. Recalculations post only the difference.'
                  )}
                </p>
              )}
              <label className="workspace-label">
                {text(
                  'Justificativa do envio, recálculo ou devolução',
                  'Reason for submission, recalculation or return'
                )}
                <textarea
                  className="workspace-input"
                  minLength={5}
                  maxLength={2000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                {can(hasPublished ? 'closing.recalculate' : 'closing.submit', 'all') && (
                  <button
                    className="workspace-primary"
                    disabled={!ready || Boolean(issues) || reason.trim().length < 5}
                    onClick={() => {
                      void run(submit);
                    }}
                  >
                    {hasPublished
                      ? text(
                          'Gerar recálculo para conferência',
                          'Generate recalculation for review'
                        )
                      : text('Enviar para conferência', 'Submit for review')}
                  </button>
                )}
                {workspace.period.state === 'REVIEW' && can('closing.approve', 'all') && (
                  <button
                    className="workspace-primary"
                    disabled={!ready}
                    onClick={() => {
                      void run(() =>
                        api.post(`/api/closing-periods/${workspace.period.id}/approve`, {
                          expectedVersion: workspace.period.version,
                        })
                      );
                    }}
                  >
                    {text('Aprovar e movimentar saldos', 'Approve and post balances')}
                  </button>
                )}
                {workspace.period.state === 'REVIEW' && can('closing.submit', 'all') && (
                  <button
                    className="workspace-secondary"
                    disabled={!ready || reason.trim().length < 5}
                    onClick={() => {
                      void run(() =>
                        api.post(`/api/closing-periods/${workspace.period.id}/return`, {
                          expectedVersion: workspace.period.version,
                          reason,
                        })
                      );
                    }}
                  >
                    {text('Devolver para ajuste', 'Return for correction')}
                  </button>
                )}
              </div>
              {capabilities?.flows.independentApproval && (
                <p className="text-sm">
                  {text(
                    'A aprovação exige uma pessoa diferente de quem enviou a revisão.',
                    'Approval requires a different person from the revision submitter.'
                  )}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
