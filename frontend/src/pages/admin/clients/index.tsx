import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import { text, translate as translateUi } from '../../../i18n';
import React, { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import Pagination from '../../../components/Pagination';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { SkeletonList } from '../../../components/Skeleton';
import EmptyState from '../../../components/EmptyState';
import StateBanner from '../../../components/StateBanner';
import api from '../../../services/api';
import { extractApiError } from '../../../utils/formatters';
import { isAbortError } from '../../../utils/abort';

interface ClientRow {
  id: number;
  name: string;
  code: string;
  lockDay: number | null;
  paysOvertime: boolean;
  requireProjectOnEntries?: boolean;
  isActive: boolean;
}

const ClientsPage: React.FC = () => {
  const { can } = useCapabilities();
  const canWrite = can('clients.write', 'all');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: 0,
    name: '',
    code: '',
    lockDay: '' as string,
    paysOvertime: true,
    requireProjectOnEntries: false,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // UX-HIGH-01: Confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    clientId: number;
    clientName: string;
  }>({
    isOpen: false,
    clientId: 0,
    clientName: '',
  });
  const [actionConfirm, setActionConfirm] = useState<
    { type: 'toggle-active'; client: ClientRow } | { type: 'reactivate-all'; count: number } | null
  >(null);

  const isEditing = form.id !== 0;

  const fetchClients = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const includeInactive = statusFilter !== 'active';
      const isActive =
        statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined;
      const response = await api.get('/api/clients', {
        params: {
          search: search || undefined,
          includeInactive,
          isActive,
          page,
          limit: pageSize,
        },
        signal,
      });
      setClients(response.data.data || []);
      setTotalClients(response.data.pagination?.total ?? (response.data.data || []).length);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(extractApiError(err, 'Falha ao carregar clientes'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    fetchClients(controller.signal);
    return () => controller.abort();
  }, [search, statusFilter, page, pageSize]);

  const paginatedClients = clients;
  const filteredClients = clients;

  const resetForm = () =>
    setForm({
      id: 0,
      name: '',
      code: '',
      lockDay: '',
      paysOvertime: true,
      requireProjectOnEntries: false,
    });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (isEditing) {
        await api.put(`/api/clients/${form.id}`, {
          name: form.name,
          code: form.code,
          lockDay: form.lockDay === '' ? null : Number(form.lockDay),
          paysOvertime: form.paysOvertime,
          requireProjectOnEntries: form.requireProjectOnEntries,
        });
      } else {
        await api.post('/api/clients', {
          name: form.name,
          code: form.code,
          lockDay: form.lockDay === '' ? null : Number(form.lockDay),
          paysOvertime: form.paysOvertime,
          requireProjectOnEntries: form.requireProjectOnEntries,
        });
      }
      resetForm();
      fetchClients();
    } catch (err) {
      setError(extractApiError(err, 'Falha ao salvar cliente'));
    }
  };

  const handleEdit = (client: ClientRow) => {
    setForm({
      id: client.id,
      name: client.name,
      code: client.code,
      lockDay: client.lockDay ? String(client.lockDay) : '',
      paysOvertime: client.paysOvertime,
      requireProjectOnEntries: Boolean(client.requireProjectOnEntries),
    });
  };

  // UX-HIGH-01: Show confirmation dialog instead of direct delete
  const handleDeleteClick = (client: ClientRow) => {
    setDeleteConfirm({ isOpen: true, clientId: client.id, clientName: client.name });
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/api/clients/${deleteConfirm.clientId}`);
      fetchClients();
    } catch (err) {
      setError(extractApiError(err, 'Falha ao excluir cliente'));
    } finally {
      setDeleteConfirm({ isOpen: false, clientId: 0, clientName: '' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, clientId: 0, clientName: '' });
  };

  const toggleClientActive = (client: ClientRow) => {
    setActionConfirm({ type: 'toggle-active', client });
  };

  const reactivateAllClients = () => {
    const inactive = filteredClients.filter((client) => !client.isActive);
    if (inactive.length === 0) return;
    setActionConfirm({ type: 'reactivate-all', count: inactive.length });
  };

  const handleActionConfirm = async () => {
    const action = actionConfirm;
    setActionConfirm(null);
    if (!action) return;
    try {
      if (action.type === 'toggle-active') {
        await api.put(`/api/clients/${action.client.id}`, { isActive: !action.client.isActive });
      } else {
        const inactive = filteredClients.filter((client) => !client.isActive);
        await Promise.all(
          inactive.map((client) => api.put(`/api/clients/${client.id}`, { isActive: true }))
        );
      }
      fetchClients();
    } catch (err) {
      setError(
        extractApiError(
          err,
          action.type === 'toggle-active'
            ? 'Falha ao atualizar cliente'
            : 'Falha ao reativar clientes'
        )
      );
    }
  };

  return (
    <AppShell title={translateUi('Clientes')} subtitle={translateUi('Gestao de clientes')}>
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <label htmlFor="client-search" className="sr-only">
            {translateUi('Buscar clientes')}
          </label>
          <input
            id="client-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={translateUi('Buscar por nome ou codigo')}
            aria-label="Buscar clientes por nome ou código"
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          />
          <label htmlFor="client-status-filter" className="sr-only">
            {translateUi('Filtrar por status')}
          </label>
          <select
            id="client-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'active' | 'inactive' | 'all')
            }
            aria-label="Filtrar clientes por status"
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          >
            <option value="active">{translateUi('Ativos')}</option>
            <option value="inactive">{translateUi('Inativos')}</option>
            <option value="all">{translateUi('Todos')}</option>
          </select>
        </div>
      </section>

      {error ? (
        <StateBanner
          tone="error"
          message={error}
          action={{ label: translateUi('Fechar'), onClick: () => setError(null) }}
        />
      ) : null}

      {canWrite && (
        <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-tt-text">
            {isEditing ? 'Editar cliente' : 'Novo cliente'}
          </h3>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="client-name" className="sr-only">
                {translateUi('Nome do cliente')}
              </label>
              <input
                id="client-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={translateUi('Nome')}
                aria-label="Nome do cliente"
                className="w-full rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="client-code" className="sr-only">
                {translateUi('Codigo do cliente')}
              </label>
              <input
                id="client-code"
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder={translateUi('Codigo')}
                aria-label="Código do cliente"
                className="w-full rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="client-lockday" className="sr-only">
                {translateUi('Dia limite para lancamentos')}
              </label>
              <input
                id="client-lockday"
                type="number"
                min={1}
                max={31}
                value={form.lockDay}
                onChange={(event) => setForm((prev) => ({ ...prev, lockDay: event.target.value }))}
                placeholder={translateUi('Dia limite (1-31)')}
                aria-label="Dia limite para lançamentos (1-31)"
                className="w-full rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
              />
            </div>
            <label
              htmlFor="client-overtime"
              className="flex min-h-touch items-center gap-2 text-sm text-tt-text"
            >
              <input
                id="client-overtime"
                type="checkbox"
                checked={form.paysOvertime}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, paysOvertime: event.target.checked }))
                }
              />
              {translateUi('Cliente paga hora extra')}
            </label>
            {isEditing ? (
              <label
                htmlFor="client-require-project"
                className="flex min-h-touch items-center gap-2 text-sm text-tt-text md:col-span-2"
              >
                <input
                  id="client-require-project"
                  type="checkbox"
                  checked={form.requireProjectOnEntries}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      requireProjectOnEntries: event.target.checked,
                    }))
                  }
                />
                {text('Exigir projeto nos lançamentos', 'Require project on time entries')}
              </label>
            ) : null}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action "
              >
                {isEditing ? translateUi('Salvar') : translateUi('Criar')}
              </button>
              {isEditing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-tt-border px-4 py-2 text-sm text-tt-warning "
                >
                  {translateUi('Cancelar')}
                </button>
              ) : null}
            </div>
          </form>
        </section>
      )}

      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        {loading ? (
          <SkeletonList count={5} />
        ) : paginatedClients.length === 0 ? (
          <EmptyState
            variant={search ? 'no-results' : 'no-clients'}
            title={search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            description={
              search
                ? 'Não encontramos clientes com os filtros selecionados.'
                : 'Comece cadastrando seu primeiro cliente usando o formulário acima.'
            }
          />
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 md:max-h-[70vh]">
            {statusFilter !== 'active' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-tt border border-tt-border bg-tt-warning-soft px-4 py-3 text-sm text-tt-warning">
                <span>
                  {translateUi('Mostrando clientes')}{' '}
                  {statusFilter === 'inactive' ? 'inativos' : 'todos'}.
                </span>
                <button
                  type="button"
                  onClick={reactivateAllClients}
                  className="tt-btn-secondary min-h-touch px-3 text-xs"
                  disabled={!canWrite}
                >
                  {translateUi('Reativar em massa')}
                </button>
              </div>
            ) : null}
            {paginatedClients.map((client) => (
              <div
                key={client.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-tt border border-tt-border bg-tt-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-tt-text">{client.name}</p>
                  <p className="text-xs text-tt-text-muted">
                    {client.code} {translateUi('· Fechamento:')}{' '}
                    {client.lockDay ? `Dia ${client.lockDay}` : 'Sem limite'}
                  </p>
                  {!client.paysOvertime ? (
                    <span className="mt-1 inline-flex rounded-full bg-tt-danger-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.16em] text-tt-danger ">
                      {translateUi('Nao paga extra')}
                    </span>
                  ) : null}
                  {!client.isActive ? (
                    <span className="mt-1 inline-flex rounded-full bg-tt-elevated px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.16em] text-tt-text-muted ">
                      {translateUi('Inativo')}
                    </span>
                  ) : null}
                  {client.requireProjectOnEntries ? (
                    <span className="mt-1 inline-flex rounded-full bg-tt-warning-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.16em] text-tt-warning">
                      {text('Exige projeto', 'Requires project')}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(client)}
                    className="tt-btn-secondary min-h-touch px-3 text-xs"
                    aria-label={`Editar cliente ${client.name}`}
                    disabled={!canWrite}
                  >
                    {translateUi('Editar')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(client)}
                    className="min-h-touch rounded-tt-control border border-tt-danger px-3 py-2 text-xs font-medium text-tt-danger"
                    aria-label={`Excluir cliente ${client.name}`}
                    disabled={!canWrite}
                  >
                    {translateUi('Excluir')}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleClientActive(client)}
                    className="tt-btn-secondary min-h-touch px-3 text-xs"
                    aria-label={`${client.isActive ? 'Desativar' : 'Ativar'} cliente ${client.name}`}
                    disabled={!canWrite}
                  >
                    {client.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading ? (
          <Pagination
            total={totalClients}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </section>

      {/* UX-HIGH-01: Confirmation dialog for delete */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={translateUi('Excluir cliente')}
        message={`Tem certeza que deseja excluir o cliente "${deleteConfirm.clientName}"? Esta ação não pode ser desfeita.`}
        confirmLabel={translateUi('Excluir')}
        cancelLabel={translateUi('Cancelar')}
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <ConfirmDialog
        isOpen={actionConfirm !== null}
        title={
          actionConfirm?.type === 'reactivate-all'
            ? 'Reativar clientes'
            : 'Alterar status do cliente'
        }
        message={
          actionConfirm?.type === 'reactivate-all'
            ? `Reativar ${actionConfirm.count} clientes inativos?`
            : actionConfirm?.type === 'toggle-active'
              ? `Tem certeza que deseja ${actionConfirm.client.isActive ? 'desativar' : 'ativar'} este cliente?`
              : ''
        }
        variant="warning"
        onConfirm={handleActionConfirm}
        onCancel={() => setActionConfirm(null)}
      />
    </AppShell>
  );
};

export default ClientsPage;
