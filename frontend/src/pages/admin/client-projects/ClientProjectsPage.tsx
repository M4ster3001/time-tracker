import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import EmptyState from '../../../components/EmptyState';
import StateBanner from '../../../components/StateBanner';
import SearchableSelect from '../../../components/SearchableSelect';
import { FieldInput, FieldTextarea } from '../../../components/FormControls';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import { text } from '../../../i18n';
import api from '../../../services/api';
import { extractApiError } from '../../../utils/formatters';
import ProjectMembershipsPanel from './ProjectMembershipsPanel';
import LegacyClassifyPanel from './LegacyClassifyPanel';

type ClientRow = { id: number; name: string; code: string };
type ProjectRow = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  state: string;
  clientId: number;
};

const STATES = ['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;

const stateLabel = (state: string) => {
  const map: Record<string, [string, string]> = {
    PLANNED: ['Planejado', 'Planned'],
    ACTIVE: ['Ativo', 'Active'],
    PAUSED: ['Pausado', 'Paused'],
    COMPLETED: ['Concluído', 'Completed'],
    ARCHIVED: ['Arquivado', 'Archived'],
  };
  return map[state] ? text(...map[state]) : state;
};

const ClientProjectsPage: React.FC = () => {
  const { can, capabilities } = useCapabilities();
  const projectsEnabled = Boolean(capabilities?.flows?.projects);
  const canWrite = can('projects.write', 'all') || can('projects.write', 'team');
  const canListAllClients = can('clients.read', 'all');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState(0);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: 0,
    code: '',
    name: '',
    description: '',
    state: 'ACTIVE',
  });
  const [sortKey, setSortKey] = useState<'code' | 'name' | 'state'>('code');
  const [sortDir, setSortDir] = useState<'ascending' | 'descending'>('ascending');

  const isEditing = form.id !== 0;

  const toggleSort = (key: 'code' | 'name' | 'state') => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'ascending' ? 'descending' : 'ascending'));
      return;
    }
    setSortKey(key);
    setSortDir('ascending');
  };

  useEffect(() => {
    const loadClients = async () => {
      try {
        // `/api/clients` is organisation-wide (admin only); managers list their own portfolio.
        const response = canListAllClients
          ? await api.get('/api/clients', { params: { includeInactive: false } })
          : await api.get('/api/manager/clients');
        const rows = (response.data.data || []) as ClientRow[];
        setClients(rows);
        if (rows.length && !clientId) setClientId(rows[0].id);
      } catch (err) {
        setError(
          extractApiError(err, text('Falha ao carregar clientes', 'Failed to load clients'))
        );
      }
    };
    if (projectsEnabled) void loadClients();
  }, [projectsEnabled]);

  const loadProjects = async (id: number) => {
    if (!id) {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/projects', { params: { clientId: id } });
      setProjects(response.data.data || []);
    } catch (err) {
      setError(extractApiError(err, text('Falha ao carregar projetos', 'Failed to load projects')));
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects(clientId);
    setForm({ id: 0, code: '', name: '', description: '', state: 'ACTIVE' });
  }, [clientId]);

  const sorted = useMemo(() => {
    const factor = sortDir === 'ascending' ? 1 : -1;
    return [...projects].sort((a, b) => {
      const left = a[sortKey] ?? '';
      const right = b[sortKey] ?? '';
      return factor * String(left).localeCompare(String(right));
    });
  }, [projects, sortKey, sortDir]);

  const resetForm = () => setForm({ id: 0, code: '', name: '', description: '', state: 'ACTIVE' });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientId || !canWrite) return;
    setMessage(null);
    setError(null);
    try {
      if (isEditing) {
        await api.put(`/api/projects/${form.id}`, {
          name: form.name,
          description: form.description || null,
          state: form.state,
        });
        setMessage(text('Projeto atualizado.', 'Project updated.'));
      } else {
        await api.post('/api/projects', {
          clientId,
          code: form.code,
          name: form.name,
          description: form.description || null,
          state: form.state,
        });
        setMessage(text('Projeto criado.', 'Project created.'));
      }
      resetForm();
      await loadProjects(clientId);
    } catch (err) {
      setError(extractApiError(err, text('Falha ao salvar projeto', 'Failed to save project')));
    }
  };

  const archive = async (project: ProjectRow) => {
    if (!canWrite) return;
    setError(null);
    try {
      await api.post(`/api/projects/${project.id}/archive`);
      setMessage(text('Projeto arquivado.', 'Project archived.'));
      if (form.id === project.id) resetForm();
      await loadProjects(clientId);
    } catch (err) {
      setError(extractApiError(err, text('Falha ao arquivar', 'Failed to archive')));
    }
  };

  if (!projectsEnabled) {
    return (
      <AppShell title={text('Projetos', 'Projects')}>
        <EmptyState
          title={text('Fluxo de projetos desligado', 'Projects flow disabled')}
          description={text(
            'Ative o fluxo “Projetos por cliente” em Acessos para gerenciar projetos.',
            'Enable the “Client projects” flow under Access to manage projects.'
          )}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={text('Projetos', 'Projects')}
      subtitle={text(
        'Organize entregas dentro de cada cliente. Código único por cliente.',
        'Organize delivery work under each client. Codes are unique per client.'
      )}
    >
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="block text-sm" htmlFor="projects-client">
          <span className="mb-1 block font-medium text-tt-text">{text('Cliente', 'Client')}</span>
          <SearchableSelect
            id="projects-client"
            value={clientId}
            onChange={(value) => setClientId(Number(value))}
            className="w-full"
            options={[
              { value: 0, label: text('Selecione um cliente', 'Select a client') },
              ...clients.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
            ]}
            placeholder={text('Selecione um cliente', 'Select a client')}
            searchPlaceholder={text('Buscar cliente...', 'Search clients...')}
          />
        </label>
      </div>

      {error ? <StateBanner tone="error" className="mb-3" message={error} /> : null}
      {message ? <StateBanner tone="success" className="mb-3" message={message} /> : null}

      {!clientId && !error ? (
        <p className="mb-6 text-sm text-tt-text-muted">
          {clients.length === 0
            ? text('Nenhum cliente disponível na sua carteira.', 'No clients available in your portfolio.')
            : text('Selecione um cliente para ver e criar projetos.', 'Select a client to view and create projects.')}
        </p>
      ) : null}

      {canWrite && clientId > 0 ? (
        <form
          onSubmit={handleSubmit}
          className="workspace-panel mb-6 grid gap-3 p-4 md:grid-cols-2"
        >
          <h3 className="md:col-span-2 text-base font-semibold text-tt-text">
            {isEditing
              ? text('Editar projeto', 'Edit project')
              : text('Novo projeto', 'New project')}
          </h3>
          {!isEditing ? (
            <FieldInput
              label={text('Código', 'Code')}
              id="project-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              required
              placeholder="API"
            />
          ) : (
            <div className="text-sm text-tt-text-muted">
              <span className="font-medium text-tt-text">{text('Código', 'Code')}:</span>{' '}
              <span className="font-mono">{form.code}</span>
            </div>
          )}
          <FieldInput
            label={text('Nome', 'Name')}
            id="project-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <label className="block text-sm md:col-span-2" htmlFor="project-state">
            <span className="mb-1 block font-medium">{text('Estado', 'State')}</span>
            <select
              id="project-state"
              className="workspace-input w-full min-h-touch"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            >
              {STATES.map((state) => (
                <option key={state} value={state}>
                  {stateLabel(state)}
                </option>
              ))}
            </select>
          </label>
          <FieldTextarea
            label={text('Descrição', 'Description')}
            id="project-description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="md:col-span-2"
          />
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button type="submit" className="workspace-primary" disabled={!clientId}>
              {isEditing
                ? text('Salvar alterações', 'Save changes')
                : text('Criar projeto', 'Create project')}
            </button>
            {isEditing ? (
              <button type="button" className="workspace-secondary" onClick={resetForm}>
                {text('Cancelar', 'Cancel')}
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {isEditing ? (
        <>
          <ProjectMembershipsPanel
            projectId={form.id}
            projectLabel={`${form.code} — ${form.name}`}
            canWrite={canWrite}
          />
          <LegacyClassifyPanel
            projectId={form.id}
            projectLabel={`${form.code} — ${form.name}`}
            canWrite={canWrite}
          />
        </>
      ) : null}

      {loading ? (
        <StateBanner tone="info" message={text('Carregando...', 'Loading...')} />
      ) : sorted.length === 0 ? (
        <EmptyState
          title={text('Nenhum projeto', 'No projects')}
          description={text(
            'Crie o primeiro projeto deste cliente ou continue lançando horas sem projeto.',
            'Create the first project for this client, or keep logging time without a project.'
          )}
        />
      ) : (
        <div className="workspace-panel tt-table-scroll">
          <table className="tt-table">
            <caption className="sr-only">
              {text('Lista de projetos do cliente selecionado', 'Projects for the selected client')}
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
                <th scope="col" aria-sort={sortKey === 'state' ? sortDir : 'none'}>
                  <button
                    type="button"
                    className="min-h-touch font-semibold text-tt-text underline-offset-2 hover:underline"
                    onClick={() => toggleSort('state')}
                  >
                    {text('Estado', 'State')}
                  </button>
                </th>
                <th scope="col">{text('Ações', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((project) => (
                <tr key={project.id}>
                  <td className="font-mono text-xs">{project.code}</td>
                  <td>{project.name}</td>
                  <td>{stateLabel(project.state)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {canWrite ? (
                        <button
                          type="button"
                          className="min-h-touch text-sm font-semibold text-tt-link underline-offset-2 hover:underline"
                          onClick={() =>
                            setForm({
                              id: project.id,
                              code: project.code,
                              name: project.name,
                              description: project.description || '',
                              state: project.state,
                            })
                          }
                        >
                          {text('Editar', 'Edit')}
                        </button>
                      ) : null}
                      {canWrite && project.state !== 'ARCHIVED' ? (
                        <button
                          type="button"
                          className="min-h-touch text-sm font-semibold text-tt-warning underline-offset-2 hover:underline"
                          onClick={() => void archive(project)}
                        >
                          {text('Arquivar', 'Archive')}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
};

export default ClientProjectsPage;
