import React, { useEffect, useMemo, useState } from 'react';
import EmptyState from '../../../components/EmptyState';
import StateBanner from '../../../components/StateBanner';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import { text, useLocale } from '../../../i18n';
import api from '../../../services/api';
import { extractApiError } from '../../../utils/formatters';
import {
  PARAMETER_SCOPE_OPTIONS,
  formatParameterScopeLabel,
  formatParameterSetSummary,
  formatTaskTypeLabel,
  scopeNeedsClient,
  scopeNeedsProject,
  sortTaskTypesForDisplay,
  type ParameterScopeKind,
  type TaskTypeAdminRow,
  type TaskTypeParameterSetRow,
} from './taskTypesUi';

type ClientOption = { id: number; name: string };
type ProjectOption = { id: number; name: string; clientId: number };

const emptyForm = () => ({
  id: 0,
  code: '',
  namePt: '',
  nameEn: '',
  description: '',
  baseMinutes: '60',
  factor: '1',
  reason: '',
  scope: 'GLOBAL' as ParameterScopeKind,
  clientId: 0,
  projectId: 0,
});

const TaskTypesPanel: React.FC = () => {
  const { capabilities, can } = useCapabilities();
  const appLocale = useLocale();
  const locale = appLocale === 'en' ? 'en' : 'pt';
  const estimatesOn = Boolean(capabilities?.flows?.estimates);
  const canManage =
    can('estimation_parameters.manage', 'all') || can('estimation_parameters.manage');
  const canRead = can('estimates.read');

  const [rows, setRows] = useState<TaskTypeAdminRow[]>([]);
  const [parameterSets, setParameterSets] = useState<TaskTypeParameterSetRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [sortKey, setSortKey] = useState<'code' | 'name' | 'state'>('code');
  const [sortDir, setSortDir] = useState<'ascending' | 'descending'>('ascending');

  const toggleSort = (key: 'code' | 'name' | 'state') => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'ascending' ? 'descending' : 'ascending'));
      return;
    }
    setSortKey(key);
    setSortDir('ascending');
  };

  const sorted = useMemo(() => {
    const base = sortTaskTypesForDisplay(rows);
    const factor = sortDir === 'ascending' ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sortKey === 'state') {
        if (a.isActive === b.isActive) return 0;
        return factor * (a.isActive ? -1 : 1);
      }
      if (sortKey === 'name') {
        const left = locale === 'en' ? a.nameEn : a.namePt;
        const right = locale === 'en' ? b.nameEn : b.namePt;
        return factor * left.localeCompare(right);
      }
      return factor * a.code.localeCompare(b.code);
    });
  }, [rows, sortKey, sortDir, locale]);
  const isEditing = form.id !== 0;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/task-types', {
        params: { includeInactive: true },
      });
      setRows((response.data.data || []) as TaskTypeAdminRow[]);
    } catch (err) {
      setError(
        extractApiError(err, text('Falha ao carregar tipos', 'Failed to load task types'))
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await api.get('/api/clients', { params: { includeInactive: false } });
      const list = (response.data.data || []) as Array<{ id: number; name: string }>;
      setClients(list.map((c) => ({ id: c.id, name: c.name })));
    } catch {
      setClients([]);
    }
  };

  const loadProjects = async (clientId: number) => {
    if (!clientId) {
      setProjects([]);
      return;
    }
    try {
      const response = await api.get('/api/projects', { params: { clientId } });
      const list = (response.data.data || []) as Array<{
        id: number;
        name: string;
        clientId: number;
      }>;
      setProjects(list.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId })));
    } catch {
      setProjects([]);
    }
  };

  const loadParameterSets = async (taskTypeId: number) => {
    if (!taskTypeId) {
      setParameterSets([]);
      return;
    }
    try {
      const response = await api.get(`/api/task-types/${taskTypeId}/parameter-sets`);
      setParameterSets((response.data.data || []) as TaskTypeParameterSetRow[]);
    } catch {
      setParameterSets([]);
    }
  };

  useEffect(() => {
    if (!estimatesOn || !canRead) return;
    void load();
    void loadClients();
  }, [estimatesOn, canRead]);

  useEffect(() => {
    if (scopeNeedsClient(form.scope) && form.clientId) {
      void loadProjects(form.clientId);
    } else {
      setProjects([]);
    }
  }, [form.scope, form.clientId]);

  const resetForm = () => {
    setForm(emptyForm());
    setParameterSets([]);
  };

  const startEdit = (row: TaskTypeAdminRow) => {
    setForm({
      id: row.id,
      code: row.code,
      namePt: row.namePt,
      nameEn: row.nameEn,
      description: row.description ?? '',
      baseMinutes: row.activeBaseMinutes == null ? '60' : String(row.activeBaseMinutes),
      factor: row.activeFactor == null ? '1' : String(row.activeFactor),
      reason: '',
      scope: 'GLOBAL',
      clientId: 0,
      projectId: 0,
    });
    setMessage(null);
    setError(null);
    void loadParameterSets(row.id);
  };

  const submitMeta = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (scopeNeedsClient(form.scope) && !form.clientId) {
      setError(text('Selecione o cliente do escopo.', 'Select the scope client.'));
      return;
    }
    if (scopeNeedsProject(form.scope) && !form.projectId) {
      setError(text('Selecione o projeto do escopo.', 'Select the scope project.'));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (isEditing) {
        await api.put(`/api/task-types/${form.id}`, {
          namePt: form.namePt,
          nameEn: form.nameEn,
          description: form.description || null,
        });
        if (form.baseMinutes.trim() && form.factor.trim()) {
          await api.put(`/api/task-types/${form.id}/parameters`, {
            baseMinutes: Number(form.baseMinutes),
            factor: Number(form.factor),
            reason: form.reason || undefined,
            scope: form.scope,
            clientId: scopeNeedsClient(form.scope) ? form.clientId : null,
            projectId: scopeNeedsProject(form.scope) ? form.projectId : null,
          });
        }
        setMessage(text('Tipo atualizado.', 'Task type updated.'));
        await loadParameterSets(form.id);
      } else {
        await api.post('/api/task-types', {
          code: form.code,
          namePt: form.namePt,
          nameEn: form.nameEn,
          description: form.description || null,
          baseMinutes: form.baseMinutes.trim() ? Number(form.baseMinutes) : null,
          factor: form.factor.trim() ? Number(form.factor) : null,
        });
        setMessage(text('Tipo criado.', 'Task type created.'));
        resetForm();
      }
      await load();
    } catch (err) {
      setError(extractApiError(err, text('Falha ao salvar tipo', 'Failed to save task type')));
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (row: TaskTypeAdminRow, isActive: boolean) => {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.put(`/api/task-types/${row.id}`, { isActive });
      setMessage(
        isActive
          ? text('Tipo reativado.', 'Task type reactivated.')
          : text('Tipo arquivado.', 'Task type archived.')
      );
      if (form.id === row.id) resetForm();
      await load();
    } catch (err) {
      setError(
        extractApiError(err, text('Falha ao alterar estado', 'Failed to change state'))
      );
    } finally {
      setBusy(false);
    }
  };

  const deactivateParameterSet = async (set: TaskTypeParameterSetRow) => {
    if (!canManage || !form.id) return;
    const scopeLabel = formatParameterScopeLabel(set.scope, locale);
    const confirmed = window.confirm(
      text(
        `Desativar conjunto ${scopeLabel} (#${set.id})? Revisões permanecem no histórico.`,
        `Deactivate ${scopeLabel} set (#${set.id})? Revisions remain in history.`
      )
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/api/task-types/${form.id}/parameter-sets/${set.id}/deactivate`);
      setMessage(text('Conjunto de parâmetros desativado.', 'Parameter set deactivated.'));
      await loadParameterSets(form.id);
      await load();
    } catch (err) {
      setError(
        extractApiError(
          err,
          text('Falha ao desativar conjunto', 'Failed to deactivate parameter set')
        )
      );
    } finally {
      setBusy(false);
    }
  };

  if (!estimatesOn) {
    return (
      <section className="tt-panel">
        <p className="text-tt-text-muted">
          {text('O fluxo de estimativas está desligado.', 'The estimates flow is turned off.')}
        </p>
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="tt-panel">
        <p className="text-tt-text-muted">
          {text('É necessário estimates.read.', 'estimates.read is required.')}
        </p>
      </section>
    );
  }

  return (
    <section className="tt-panel space-y-4" aria-labelledby="task-types-heading">
      <div>
        <h3 id="task-types-heading" className="text-lg font-semibold text-tt-text">
          {text('Tipos de tarefa', 'Task types')}
        </h3>
        <p className="mt-1 text-sm text-tt-text-muted">
          {text(
            'Catálogo da organização. Parâmetros versionados com precedência projeto > cliente > global.',
            'Organization catalog. Versioned parameters with project > client > global precedence.'
          )}
        </p>
      </div>

      {error ? <StateBanner tone="error" message={error} /> : null}
      {message ? <StateBanner tone="success" message={message} /> : null}

      {canManage ? (
        <form
          onSubmit={submitMeta}
          className="grid gap-3 rounded-tt border border-tt-border bg-tt-elevated p-4 md:grid-cols-2"
        >
          <label className="block text-sm" htmlFor="task-type-code">
            <span className="mb-1 block font-medium text-tt-text">{text('Código', 'Code')}</span>
            <input
              id="task-type-code"
              className="workspace-input w-full min-h-touch font-mono"
              value={form.code}
              disabled={isEditing || busy}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
              required={!isEditing}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm" htmlFor="task-type-description">
            <span className="mb-1 block font-medium text-tt-text">
              {text('Descrição', 'Description')}
            </span>
            <input
              id="task-type-description"
              className="workspace-input w-full min-h-touch"
              value={form.description}
              disabled={busy}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>
          <label className="block text-sm" htmlFor="task-type-name-pt">
            <span className="mb-1 block font-medium text-tt-text">{text('Nome PT', 'Name PT')}</span>
            <input
              id="task-type-name-pt"
              className="workspace-input w-full min-h-touch"
              value={form.namePt}
              disabled={busy}
              onChange={(e) => setForm((prev) => ({ ...prev, namePt: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm" htmlFor="task-type-name-en">
            <span className="mb-1 block font-medium text-tt-text">{text('Nome EN', 'Name EN')}</span>
            <input
              id="task-type-name-en"
              className="workspace-input w-full min-h-touch"
              value={form.nameEn}
              disabled={busy}
              onChange={(e) => setForm((prev) => ({ ...prev, nameEn: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm" htmlFor="task-type-scope">
            <span className="mb-1 block font-medium text-tt-text">
              {text('Escopo dos parâmetros', 'Parameter scope')}
            </span>
            <select
              id="task-type-scope"
              className="workspace-input w-full min-h-touch"
              value={form.scope}
              disabled={busy || !isEditing}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  scope: e.target.value as ParameterScopeKind,
                  projectId: 0,
                }))
              }
            >
              {PARAMETER_SCOPE_OPTIONS.map((scope) => (
                <option key={scope} value={scope}>
                  {formatParameterScopeLabel(scope, locale)}
                </option>
              ))}
            </select>
            {!isEditing ? (
              <span className="mt-1 block text-xs text-tt-text-muted">
                {text(
                  'Na criação, parâmetros iniciais são GLOBAL. Escopos cliente/projeto na edição.',
                  'On create, initial parameters are GLOBAL. Client/project scopes when editing.'
                )}
              </span>
            ) : null}
          </label>
          {isEditing && scopeNeedsClient(form.scope) ? (
            <label className="block text-sm" htmlFor="task-type-scope-client">
              <span className="mb-1 block font-medium text-tt-text">
                {text('Cliente do escopo', 'Scope client')}
              </span>
              <select
                id="task-type-scope-client"
                className="workspace-input w-full min-h-touch"
                value={form.clientId || ''}
                disabled={busy}
                required
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    clientId: Number(e.target.value) || 0,
                    projectId: 0,
                  }))
                }
              >
                <option value="">{text('Selecione…', 'Select…')}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {isEditing && scopeNeedsProject(form.scope) ? (
            <label className="block text-sm" htmlFor="task-type-scope-project">
              <span className="mb-1 block font-medium text-tt-text">
                {text('Projeto do escopo', 'Scope project')}
              </span>
              <select
                id="task-type-scope-project"
                className="workspace-input w-full min-h-touch"
                value={form.projectId || ''}
                disabled={busy || !form.clientId}
                required
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    projectId: Number(e.target.value) || 0,
                  }))
                }
              >
                <option value="">{text('Selecione…', 'Select…')}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm" htmlFor="task-type-base">
            <span className="mb-1 block font-medium text-tt-text">
              {text('Base (min)', 'Base (min)')}
            </span>
            <input
              id="task-type-base"
              className="workspace-input w-full min-h-touch font-mono"
              value={form.baseMinutes}
              disabled={busy}
              onChange={(e) => setForm((prev) => ({ ...prev, baseMinutes: e.target.value }))}
              inputMode="numeric"
            />
          </label>
          <label className="block text-sm" htmlFor="task-type-factor">
            <span className="mb-1 block font-medium text-tt-text">{text('Fator', 'Factor')}</span>
            <input
              id="task-type-factor"
              className="workspace-input w-full min-h-touch font-mono"
              value={form.factor}
              disabled={busy}
              onChange={(e) => setForm((prev) => ({ ...prev, factor: e.target.value }))}
              inputMode="decimal"
            />
          </label>
          {isEditing ? (
            <label className="block text-sm md:col-span-2" htmlFor="task-type-reason">
              <span className="mb-1 block font-medium text-tt-text">
                {text('Motivo da revisão de parâmetros', 'Parameter revision reason')}
              </span>
              <input
                id="task-type-reason"
                className="workspace-input w-full min-h-touch"
                value={form.reason}
                disabled={busy}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button type="submit" className="tt-btn-primary min-h-touch" disabled={busy}>
              {isEditing
                ? text('Salvar alterações', 'Save changes')
                : text('Criar tipo', 'Create type')}
            </button>
            {isEditing ? (
              <button
                type="button"
                className="tt-btn-secondary min-h-touch"
                disabled={busy}
                onClick={resetForm}
              >
                {text('Cancelar edição', 'Cancel edit')}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <StateBanner
          tone="info"
          message={text(
            'Somente leitura. estimation_parameters.manage é necessário para criar ou editar.',
            'Read-only. estimation_parameters.manage is required to create or edit.'
          )}
        />
      )}

      {isEditing && parameterSets.length > 0 ? (
        <div className="rounded-tt border border-tt-border bg-tt-elevated p-4">
          <h4 className="text-sm font-semibold text-tt-text">
            {text('Conjuntos de parâmetros ativos', 'Active parameter sets')}
          </h4>
          <ul className="mt-2 space-y-2 text-sm text-tt-text-muted">
            {parameterSets.map((set) => (
              <li
                key={set.id}
                className="flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums"
              >
                <span>{formatParameterSetSummary(set, locale)}</span>
                {canManage ? (
                  <button
                    type="button"
                    className="min-h-touch rounded-tt border border-tt-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-tt-danger hover:bg-tt-danger-soft disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void deactivateParameterSet(set)}
                  >
                    {text('Desativar', 'Deactivate')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <StateBanner
          tone="info"
          message={text('Carregando tipos...', 'Loading task types...')}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          title={text('Nenhum tipo de tarefa', 'No task types')}
          description={text(
            'Crie o primeiro tipo (ex.: IMPLEMENTATION) com base e fator GLOBAL opcionais.',
            'Create the first type (e.g. IMPLEMENTATION) with optional GLOBAL base and factor.'
          )}
        />
      ) : (
        <div className="tt-table-scroll">
          <table className="tt-table">
            <caption className="sr-only">
              {text('Lista de tipos de tarefa', 'Task types list')}
            </caption>
            <thead>
              <tr>
                <th scope="col" aria-sort={sortKey === 'code' ? sortDir : 'none'}>
                  <button
                    type="button"
                    className="min-h-touch font-semibold text-tt-text underline-offset-2 hover:underline"
                    onClick={() => toggleSort('code')}
                  >
                    {text('Código', 'Code')}
                  </button>
                </th>
                <th scope="col" aria-sort={sortKey === 'name' ? sortDir : 'none'}>
                  <button
                    type="button"
                    className="min-h-touch font-semibold text-tt-text underline-offset-2 hover:underline"
                    onClick={() => toggleSort('name')}
                  >
                    {text('Nome', 'Name')}
                  </button>
                </th>
                <th scope="col">{text('Parâmetros GLOBAL', 'GLOBAL parameters')}</th>
                <th scope="col" aria-sort={sortKey === 'state' ? sortDir : 'none'}>
                  <button
                    type="button"
                    className="min-h-touch font-semibold text-tt-text underline-offset-2 hover:underline"
                    onClick={() => toggleSort('state')}
                  >
                    {text('Estado', 'State')}
                  </button>
                </th>
                {canManage ? <th scope="col">{text('Ações', 'Actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-sm">{row.code}</td>
                  <td>
                    <span className="block text-sm text-tt-text">
                      {formatTaskTypeLabel(row, 'pt')}
                    </span>
                    <span className="block text-xs text-tt-text-muted">
                      {formatTaskTypeLabel(row, 'en')}
                    </span>
                  </td>
                  <td className="font-mono text-sm tabular-nums">
                    {row.activeBaseMinutes == null || row.activeFactor == null
                      ? '—'
                      : `${row.activeBaseMinutes} × ${row.activeFactor}`}
                  </td>
                  <td>
                    <span
                      className={`inline-flex rounded-tt px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                        row.isActive
                          ? 'bg-tt-success-soft text-tt-success'
                          : 'bg-tt-elevated text-tt-text-muted'
                      }`}
                    >
                      {row.isActive
                        ? text('Ativo', 'Active')
                        : text('Arquivado', 'Archived')}
                    </span>
                  </td>
                  {canManage ? (
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="min-h-touch text-sm font-semibold text-tt-link underline-offset-2 hover:underline"
                          disabled={busy}
                          onClick={() => startEdit(row)}
                        >
                          {text('Editar', 'Edit')}
                        </button>
                        <button
                          type="button"
                          className="min-h-touch text-sm font-semibold text-tt-warning underline-offset-2 hover:underline"
                          disabled={busy}
                          onClick={() => void setActive(row, !row.isActive)}
                        >
                          {row.isActive
                            ? text('Arquivar', 'Archive')
                            : text('Reativar', 'Reactivate')}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default TaskTypesPanel;
