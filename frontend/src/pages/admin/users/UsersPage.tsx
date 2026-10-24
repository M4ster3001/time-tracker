import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import { text, translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import { SkeletonList } from '../../../components/Skeleton';
import Pagination from '../../../components/Pagination';
import ConfirmDialog from '../../../components/ConfirmDialog';
import EmptyState from '../../../components/EmptyState';
import StateBanner from '../../../components/StateBanner';
import { extractApiError, validatePasswordStrength } from '../../../utils/formatters';
import {
  changeUserPassword,
  createUser,
  deleteUser,
  getClients,
  getManagers,
  getUserClients,
  getUsers,
  linkClientToUser,
  reactivateUsers,
  unlinkClientFromUser,
  updateUser,
} from './services';
import { isAbortError } from '../../../utils/abort';
import { createEmptyDeleteConfirm, createEmptyUserForm, roleLabel, roleOptions } from './constants';
import { inferUserRoleId } from './mappers';
import type { ClientRow, DeleteConfirmState, UserRow, UsersFormState } from './types';

const UsersPage: React.FC = () => {
  const { can } = useCapabilities();
  const canWrite = can('people.write', 'all');
  const canManageAccess = can('access.manage', 'all');
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [managers, setManagers] = useState<UserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientUserId, setClientUserId] = useState<number | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // UX-HIGH-01: Confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(
    createEmptyDeleteConfirm()
  );
  const [actionConfirm, setActionConfirm] = useState<
    { type: 'toggle-active'; user: UserRow } | { type: 'reactivate-all'; count: number } | null
  >(null);

  const [form, setForm] = useState<UsersFormState>(createEmptyUserForm());

  const isEditing = form.id !== 0;

  const paginatedUsers = users;

  const fetchUsers = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const includeInactive = statusFilter !== 'active';
      const isActive =
        statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined;
      const result = await getUsers({
        search,
        roleId,
        page,
        limit: pageSize,
        includeInactive,
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        signal,
      });
      setUsers(result.data);
      setTotalUsers(result.pagination.total);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(extractApiError(err, 'Falha ao carregar usuários'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, roleId, statusFilter, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);
    return () => controller.abort();
  }, [search, roleId, statusFilter, page, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    const loadSideData = async () => {
      try {
        const [nextClients, nextManagers] = await Promise.all([
          getClients(controller.signal),
          getManagers(controller.signal),
        ]);
        setClients(nextClients);
        setManagers(nextManagers);
      } catch (err) {
        if (isAbortError(err)) return;
        setClients([]);
        setManagers([]);
      }
    };
    loadSideData();
    return () => controller.abort();
  }, []);

  const resetForm = () => {
    setForm(createEmptyUserForm());
  };

  const passwordValidation = useMemo(
    () => validatePasswordStrength(form.password),
    [form.password]
  );

  const newPasswordValidation = useMemo(() => validatePasswordStrength(newPassword), [newPassword]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isEditing && !passwordValidation.isValid) {
      setError('Senha não atende os requisitos: ' + passwordValidation.errors.join('. '));
      return;
    }
    try {
      if (isEditing) {
        await updateUser(form.id, {
          name: form.name,
          email: form.email,
          ...(canManageAccess ? { roleId: form.roleId } : {}),
          managerId: form.managerId || null,
        });
      } else {
        await createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          roleId: form.roleId,
          managerId: form.managerId || null,
        });
      }
      resetForm();
      setNotice(isEditing ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.');
      fetchUsers();
    } catch (err) {
      setError(extractApiError(err, 'Falha ao salvar usuário'));
    }
  };

  const handleEdit = (user: UserRow) => {
    const inferredRoleId = inferUserRoleId(user);
    if (user.roleId === 2 || inferredRoleId === 2) {
      navigate(`/admin/managers?managerId=${user.id}`);
      return;
    }
    if (user.roleId === 3 || inferredRoleId === 3) {
      navigate(`/admin/consultants?consultantId=${user.id}`);
      return;
    }
    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '',
      roleId: user.roleId,
      managerId: user.managerId ?? 0,
    });
  };

  // UX-HIGH-01: Show confirmation dialog instead of direct delete
  const handleDeleteClick = (user: UserRow) => {
    setDeleteConfirm({ isOpen: true, userId: user.id, userName: user.name });
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteUser(deleteConfirm.userId);
      setNotice('Usuário excluido com sucesso.');
      fetchUsers();
    } catch (err) {
      setError(extractApiError(err, 'Falha ao excluir usuário'));
    } finally {
      setDeleteConfirm({ isOpen: false, userId: 0, userName: '' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, userId: 0, userName: '' });
  };

  const toggleUserActive = (user: UserRow) => {
    setActionConfirm({ type: 'toggle-active', user });
  };

  const reactivateAllUsers = () => {
    const inactive = users.filter((user) => !user.isActive);
    if (inactive.length === 0) return;
    setActionConfirm({ type: 'reactivate-all', count: inactive.length });
  };

  const handleActionConfirm = async () => {
    const action = actionConfirm;
    setActionConfirm(null);
    if (!action) return;
    try {
      if (action.type === 'toggle-active') {
        await updateUser(action.user.id, { isActive: !action.user.isActive });
        setNotice(
          action.user.isActive ? 'Usuário desativado com sucesso.' : 'Usuário ativado com sucesso.'
        );
      } else {
        const inactive = users.filter((user) => !user.isActive);
        await reactivateUsers(inactive.map((user) => user.id));
        setNotice('Usuários reativados com sucesso.');
      }
      fetchUsers();
    } catch (err) {
      setError(
        extractApiError(
          err,
          action.type === 'toggle-active'
            ? 'Falha ao atualizar usuário'
            : 'Falha ao reativar usuários'
        )
      );
    }
  };

  const openClientLinker = async (userId: number) => {
    if (clientUserId === userId) {
      setClientUserId(null);
      setSelectedClientIds([]);
      return;
    }
    setClientUserId(userId);
    try {
      const ids = (await getUserClients(userId, false)).map((client: ClientRow) => client.id);
      setSelectedClientIds(ids);
    } catch (_err) {
      setSelectedClientIds([]);
    }
  };

  const toggleClient = async (userId: number, clientIdToToggle: number) => {
    const targetClient = clients.find((client) => client.id === clientIdToToggle);
    if (targetClient && !targetClient.isActive) {
      setError('Cliente inativo não pode ser vinculado');
      return;
    }
    const isLinked = selectedClientIds.includes(clientIdToToggle);
    setSelectedClientIds((prev) =>
      isLinked ? prev.filter((id) => id !== clientIdToToggle) : [...prev, clientIdToToggle]
    );
    try {
      if (isLinked) {
        await unlinkClientFromUser(userId, clientIdToToggle);
      } else {
        await linkClientToUser(userId, clientIdToToggle);
      }
      setNotice('Clientes vinculados atualizados com sucesso.');
    } catch (err) {
      setError(extractApiError(err, 'Falha ao atualizar clientes'));
    }
  };

  const openPasswordReset = (userId: number) => {
    if (passwordUserId === userId) {
      setPasswordUserId(null);
      setNewPassword('');
      return;
    }
    setPasswordUserId(userId);
    setNewPassword('');
  };

  const handlePasswordChange = async () => {
    if (!passwordUserId || !newPasswordValidation.isValid) {
      setError('Senha não atende os requisitos: ' + newPasswordValidation.errors.join('. '));
      return;
    }
    try {
      await changeUserPassword(passwordUserId, newPassword);
      setNotice('Senha atualizada com sucesso.');
      setPasswordUserId(null);
      setNewPassword('');
    } catch (err) {
      setError(extractApiError(err, 'Falha ao atualizar senha'));
    }
  };

  return (
    <AppShell
      title={translateUi('Usuarios')}
      subtitle={translateUi('Gestao de usuarios e permissoes')}
    >
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <label htmlFor="user-search" className="sr-only">
            {translateUi('Buscar usuarios')}
          </label>
          <input
            id="user-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={translateUi('Buscar por nome ou email')}
            autoComplete="off"
            aria-label="Buscar usuários por nome ou email"
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          />
          <label htmlFor="user-status-filter" className="sr-only">
            {translateUi('Filtrar por status')}
          </label>
          <select
            id="user-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'active' | 'inactive' | 'all')
            }
            aria-label="Filtrar usuários por status"
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          >
            <option value="active">{translateUi('Ativos')}</option>
            <option value="inactive">{translateUi('Inativos')}</option>
            <option value="all">{translateUi('Todos')}</option>
          </select>
          <label htmlFor="user-role-filter" className="sr-only">
            {text('Filtrar por perfil', 'Filter by role')}
          </label>
          <select
            id="user-role-filter"
            value={roleId}
            onChange={(event) => setRoleId(Number(event.target.value))}
            aria-label={text('Filtrar usuários por perfil', 'Filter users by role')}
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          >
            <option value={0}>{text('Todos os perfis', 'All roles')}</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {roleLabel(role.id)}
              </option>
            ))}
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
      {notice ? (
        <StateBanner
          tone="success"
          message={notice}
          action={{ label: translateUi('Fechar'), onClick: () => setNotice(null) }}
        />
      ) : null}

      {canWrite && (isEditing || canManageAccess) && (
        <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-tt-text">
            {isEditing ? 'Editar usuário' : 'Novo usuário'}
          </h3>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={translateUi('Nome')}
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
              required
            />
            <input
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Email"
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
              required
            />
            {!isEditing ? (
              <div>
                <input
                  value={form.password}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder={translateUi('Senha')}
                  type="password"
                  className="w-full rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
                  required
                />
                {form.password.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {[
                      { label: 'Mínimo 12 caracteres', ok: form.password.length >= 12 },
                      { label: 'Letra minuscula', ok: /[a-z]/.test(form.password) },
                      { label: 'Letra maiuscula', ok: /[A-Z]/.test(form.password) },
                      { label: 'Número', ok: /[0-9]/.test(form.password) },
                      {
                        label: 'Caractere especial',
                        ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password),
                      },
                    ].map((rule) => (
                      <li
                        key={rule.label}
                        className={rule.ok ? 'text-tt-success' : 'text-tt-text-muted'}
                      >
                        {rule.ok ? '\u2713' : '\u2022'} {rule.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-tt-text-muted">
                {translateUi('Para trocar senha use o botao dedicado.')}
              </div>
            )}
            <select
              value={form.roleId}
              disabled={!canManageAccess}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, roleId: Number(event.target.value) }))
              }
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
            >
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {roleLabel(role.id)}
                </option>
              ))}
            </select>
            <select
              value={form.managerId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, managerId: Number(event.target.value) }))
              }
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
              disabled={form.roleId !== 3}
            >
              <option value={0}>{text('Sem gestor', 'No manager')}</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action"
              >
                {isEditing ? translateUi('Salvar') : translateUi('Criar')}
              </button>
              {isEditing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-tt-border px-4 py-2 text-sm text-tt-warning"
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
        ) : paginatedUsers.length === 0 ? (
          <EmptyState
            variant={search ? 'no-results' : 'no-users'}
            title={search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
            description={
              search
                ? 'Não encontramos usuários com os filtros selecionados.'
                : 'Comece cadastrando seu primeiro usuário usando o formulário acima.'
            }
          />
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 md:max-h-[70vh]">
            {statusFilter !== 'active' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-tt-border bg-tt-warning-soft/70 px-4 py-3 text-sm text-tt-warning">
                <span>
                  {translateUi('Mostrando usuarios')}{' '}
                  {statusFilter === 'inactive' ? 'inativos' : 'todos'}.
                </span>
                <button
                  type="button"
                  onClick={reactivateAllUsers}
                  className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning"
                  disabled={!canWrite}
                >
                  {translateUi('Reativar em massa')}
                </button>
              </div>
            ) : null}
            {paginatedUsers.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-tt border border-tt-border bg-tt-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-tt-text">{user.name}</p>
                  {user.email !== user.name ? (
                    <p className="text-xs text-tt-text-muted">{user.email}</p>
                  ) : null}
                  {!user.isActive ? (
                    <span className="mt-1 inline-flex rounded-tt bg-tt-danger-soft px-2 py-1 text-xs font-semibold uppercase tracking-wide text-tt-danger">
                      {translateUi('Inativo')}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-tt-text-muted">
                  {roleLabel(user.roleId)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(user)}
                    className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning"
                    disabled={!canWrite}
                  >
                    {translateUi('Editar')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openClientLinker(user.id)}
                    className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning"
                    disabled={!canWrite}
                  >
                    {translateUi('Clientes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openPasswordReset(user.id)}
                    className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning"
                    disabled={!canWrite}
                  >
                    {translateUi('Senha')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(user)}
                    className="rounded-full border border-tt-danger px-3 py-1 text-xs text-tt-danger"
                    aria-label={`Excluir usuário ${user.name}`}
                    disabled={!canWrite}
                  >
                    {translateUi('Excluir')}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleUserActive(user)}
                    className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning"
                    disabled={!canWrite}
                  >
                    {user.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
                {clientUserId === user.id ? (
                  <div className="mt-4 w-full rounded-2xl border border-tt-border bg-tt-elevated p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
                      {translateUi('Clientes vinculados')}
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {clients.map((client) => (
                        <label
                          key={client.id}
                          className="flex items-center gap-2 text-sm text-tt-text"
                        >
                          <input
                            type="checkbox"
                            checked={selectedClientIds.includes(client.id)}
                            onChange={() => toggleClient(user.id, client.id)}
                            disabled={!client.isActive}
                          />
                          <span className={client.isActive ? '' : 'text-tt-text-muted'}>
                            {client.name}
                          </span>
                          {!client.isActive ? (
                            <span className="rounded-tt bg-tt-elevated px-2 py-1 text-xs font-semibold uppercase tracking-wide text-tt-text-muted">
                              {translateUi('Inativo')}
                            </span>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                {passwordUserId === user.id ? (
                  <div className="mt-4 w-full rounded-2xl border border-tt-border bg-tt-elevated p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
                      {translateUi('Trocar senha')}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          placeholder={translateUi('Nova senha')}
                          autoComplete="new-password"
                          className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
                        />
                        {newPassword.length > 0 ? (
                          <ul className="mt-2 space-y-0.5 text-xs">
                            {[
                              { label: 'Mínimo 12 caracteres', ok: newPassword.length >= 12 },
                              { label: 'Letra minuscula', ok: /[a-z]/.test(newPassword) },
                              { label: 'Letra maiuscula', ok: /[A-Z]/.test(newPassword) },
                              { label: 'Número', ok: /[0-9]/.test(newPassword) },
                              {
                                label: 'Caractere especial',
                                ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword),
                              },
                            ].map((rule) => (
                              <li
                                key={rule.label}
                                className={rule.ok ? 'text-tt-success' : 'text-tt-text-muted'}
                              >
                                {rule.ok ? '\u2713' : '\u2022'} {rule.label}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={handlePasswordChange}
                        disabled={!newPasswordValidation.isValid}
                        className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action disabled:opacity-60"
                      >
                        {translateUi('Atualizar')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {!loading ? (
          <Pagination
            total={totalUsers}
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
        title={translateUi('Excluir usuario')}
        message={`Tem certeza que deseja excluir o usuário "${deleteConfirm.userName}"? Esta ação não pode ser desfeita.`}
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
            ? 'Reativar usuários'
            : 'Alterar status do usuário'
        }
        message={
          actionConfirm?.type === 'reactivate-all'
            ? `Reativar ${actionConfirm.count} usuários inativos?`
            : actionConfirm?.type === 'toggle-active'
              ? `Tem certeza que deseja ${actionConfirm.user.isActive ? 'desativar' : 'ativar'} este usuário?`
              : ''
        }
        variant="warning"
        onConfirm={handleActionConfirm}
        onCancel={() => setActionConfirm(null)}
      />
    </AppShell>
  );
};

export default UsersPage;
