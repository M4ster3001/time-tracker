import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import ConfirmDialog from '../../../components/ConfirmDialog';
import InfoTooltip from '../../../components/InfoTooltip';
import { extractApiError } from '../../../utils/formatters';
import {
  bulkActivateAdminUsers,
  bulkDeactivateAdminUsers,
  downloadAdminUsersTemplate,
  fetchAdminBulkUsers,
  importAdminUsers,
} from './services/adminBulkOperations.service';
import type {
  BulkImportResult,
  BulkStatusResult,
  UserRow,
} from './types/adminBulkOperations.types';

const AdminBulkOperationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'activate' | 'deactivate'>('import');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Import state
  const [csvContent, setCsvContent] = useState('');
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

  // Users for bulk activate/deactivate
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [statusResult, setStatusResult] = useState<BulkStatusResult | null>(null);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'warning',
    action: async () => {},
  });

  // Fetch users for activate/deactivate tabs
  const fetchUsers = async () => {
    try {
      setUsers(await fetchAdminBulkUsers());
    } catch (err) {
      setError(extractApiError(err, 'Falha ao carregar usuários'));
    }
  };

  useEffect(() => {
    if (activeTab !== 'import') {
      fetchUsers();
    }
  }, [activeTab]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvContent(e.target?.result as string);
      setImportResult(null);
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      setError('Nenhum conteudo CSV para importar');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await importAdminUsers(csvContent);
      setImportResult(response.data);
      setSuccessMessage(response.message);
      setCsvContent('');
    } catch (err) {
      setError(extractApiError(err, 'Falha ao importar usuários'));
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const blob = await downloadAdminUsersTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'users_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(extractApiError(err, 'Falha ao baixar template'));
    }
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    const visibleUsers =
      activeTab === 'activate'
        ? users.filter((u) => !u.isActive && u.roleId !== 1)
        : users.filter((u) => u.isActive && u.roleId !== 1);
    setSelectedUserIds(new Set(visibleUsers.map((u) => u.id)));
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  const handleBulkActivate = () => {
    if (selectedUserIds.size === 0) {
      setError('Selecione pelo menos um usuário');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Ativar usuários',
      message: `Deseja ativar ${selectedUserIds.size} usuário(s)?`,
      variant: 'info',
      action: async () => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
          const response = await bulkActivateAdminUsers(Array.from(selectedUserIds));
          setStatusResult(response.data);
          setSuccessMessage(response.message);
          setSelectedUserIds(new Set());
          fetchUsers();
        } catch (err) {
          setError(extractApiError(err, 'Falha ao ativar usuários'));
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleBulkDeactivate = () => {
    if (selectedUserIds.size === 0) {
      setError('Selecione pelo menos um usuário');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Desativar usuários',
      message: `Deseja desativar ${selectedUserIds.size} usuário(s)? Eles não poderão mais fazer login.`,
      variant: 'danger',
      action: async () => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
          const response = await bulkDeactivateAdminUsers(Array.from(selectedUserIds));
          setStatusResult(response.data);
          setSuccessMessage(response.message);
          setSelectedUserIds(new Set());
          fetchUsers();
        } catch (err) {
          setError(extractApiError(err, 'Falha ao desativar usuários'));
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const filteredUsers =
    activeTab === 'activate'
      ? users.filter((u) => !u.isActive && u.roleId !== 1)
      : users.filter((u) => u.isActive && u.roleId !== 1);

  return (
    <AppShell
      title={translateUi('Operacoes em Massa')}
      subtitle={translateUi('Importacao e gerenciamento de usuarios')}
    >
      {/* Tabs */}
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('import');
              setSelectedUserIds(new Set());
              setStatusResult(null);
            }}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              activeTab === 'import'
                ? 'bg-tt-action text-tt-on-action '
                : 'border border-tt-border text-tt-warning '
            }`}
          >
            {translateUi('Importar CSV')}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('activate');
              setImportResult(null);
            }}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              activeTab === 'activate'
                ? 'bg-tt-action text-tt-on-action '
                : 'border border-tt-border text-tt-warning '
            }`}
          >
            {translateUi('Ativar em Massa')}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('deactivate');
              setImportResult(null);
            }}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              activeTab === 'deactivate'
                ? 'bg-tt-action text-tt-on-action '
                : 'border border-tt-border text-tt-warning '
            }`}
          >
            {translateUi('Desativar em Massa')}
          </button>
        </div>
      </section>

      {/* Messages */}
      {error && (
        <div className="rounded-3xl border border-tt-danger bg-tt-danger-soft p-4 text-sm text-tt-danger ">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-3 text-xs underline">
            {translateUi('Fechar')}
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-3xl border border-tt-success bg-tt-success-soft p-4 text-sm text-tt-success ">
          {successMessage}
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="ml-3 text-xs underline"
          >
            {translateUi('Fechar')}
          </button>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-tt-text">
              {translateUi('Importar Usuarios via CSV')}
            </h3>
            <InfoTooltip content="Formato do CSV: name, email, password (opcional), roleId (1=Admin, 2=Manager, 3=Consultant), managerId (opcional)." />
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-2xl border border-tt-border px-4 py-2 text-sm font-medium text-tt-warning "
            >
              {translateUi('Baixar Template')}
            </button>
            <label className="cursor-pointer rounded-2xl border border-tt-border px-4 py-2 text-sm font-medium text-tt-warning ">
              {translateUi('Carregar Arquivo')}
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div className="mt-4">
            <label htmlFor="csv-content" className="mb-1 block text-sm font-medium text-tt-text">
              {translateUi('Conteudo CSV')}
            </label>
            <textarea
              id="csv-content"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder={translateUi('Cole o conteudo CSV aqui ou carregue um arquivo...')}
              rows={8}
              className="w-full rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm font-mono"
            />
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={loading || !csvContent.trim()}
            className="mt-4 rounded-2xl bg-tt-action px-6 py-2 text-sm font-semibold text-tt-on-action disabled:opacity-50 "
          >
            {loading ? 'Importando...' : 'Importar Usuários'}
          </button>

          {/* Import Result */}
          {importResult && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-tt-success bg-tt-success-soft p-4 ">
                  <p className="text-sm text-tt-success ">{translateUi('Criados com sucesso')}</p>
                  <p className="text-2xl font-bold text-tt-action ">{importResult.success}</p>
                </div>
                <div className="rounded-2xl border border-tt-danger bg-tt-danger-soft p-4 ">
                  <p className="text-sm text-tt-danger ">{translateUi('Falhas')}</p>
                  <p className="text-2xl font-bold text-tt-danger ">{importResult.failed}</p>
                </div>
              </div>

              {importResult.created.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-tt-text">
                    {translateUi('Usuarios criados:')}
                  </p>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-tt-border bg-tt-surface p-3">
                    {importResult.created.map((user) => (
                      <p key={user.id} className="text-xs text-tt-text-muted">
                        {user.name} ({user.email})
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-tt-danger ">{translateUi('Erros:')}</p>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-tt-danger bg-tt-danger-soft p-3 ">
                    {importResult.errors.map((err, idx) => (
                      <p key={idx} className="text-xs text-tt-danger ">
                        {translateUi('Linha')} {err.row} ({err.email}): {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Activate/Deactivate Tabs */}
      {(activeTab === 'activate' || activeTab === 'deactivate') && (
        <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-tt-text">
              {activeTab === 'activate' ? 'Usuários Inativos' : 'Usuários Ativos'}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllVisible}
                className="rounded-xl border border-tt-border px-3 py-1 text-xs text-tt-warning "
              >
                {translateUi('Selecionar Todos')}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-xl border border-tt-border px-3 py-1 text-xs text-tt-warning "
              >
                {translateUi('Limpar Selecao')}
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm text-tt-text-muted">
            <span>
              {selectedUserIds.size} {translateUi('usuario(s) selecionado(s) de')}{' '}
              {filteredUsers.length} {translateUi('disponivel(is)')}
            </span>
            <InfoTooltip content="Use a seleção para ativar, desativar ou remover usuários em lote." />
          </div>

          <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-tt-text-muted">
                {translateUi('Nenhum usuario')}{' '}
                {activeTab === 'activate' ? 'inativo' : translateUi('ativo')}
                {translateUi('encontrado.')}
              </p>
            ) : (
              filteredUsers.map((user) => (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-tt-border bg-tt-surface px-4 py-3 transition hover:bg-tt-warning-soft"
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(user.id)}
                    onChange={() => toggleUserSelection(user.id)}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-tt-text">{user.name}</p>
                    <p className="text-xs text-tt-text-muted">{user.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.roleId === 1
                        ? 'bg-tt-info-soft text-tt-info '
                        : user.roleId === 2
                          ? 'bg-tt-info-soft text-tt-link '
                          : 'bg-tt-elevated text-tt-text-muted '
                    }`}
                  >
                    {user.roleId === 1 ? 'Admin' : user.roleId === 2 ? 'Manager' : 'Consultant'}
                  </span>
                </label>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={activeTab === 'activate' ? handleBulkActivate : handleBulkDeactivate}
            disabled={loading || selectedUserIds.size === 0}
            className={`mt-4 rounded-2xl px-6 py-2 text-sm font-semibold text-tt-on-action disabled:opacity-50 ${
              activeTab === 'activate' ? 'bg-tt-action ' : 'bg-tt-danger dark:bg-tt-danger'
            }`}
          >
            {loading
              ? 'Processando...'
              : activeTab === 'activate'
                ? `Ativar ${selectedUserIds.size} Usuário(s)`
                : `Desativar ${selectedUserIds.size} Usuário(s)`}
          </button>

          {/* Status Result */}
          {statusResult && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-tt-success bg-tt-success-soft p-4 ">
                  <p className="text-sm text-tt-success ">{translateUi('Sucesso')}</p>
                  <p className="text-2xl font-bold text-tt-action ">{statusResult.success}</p>
                </div>
                <div className="rounded-2xl border border-tt-danger bg-tt-danger-soft p-4 ">
                  <p className="text-sm text-tt-danger ">{translateUi('Falhas')}</p>
                  <p className="text-2xl font-bold text-tt-danger ">{statusResult.failed}</p>
                </div>
              </div>

              {statusResult.errors.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-tt-danger ">{translateUi('Erros:')}</p>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-tt-danger bg-tt-danger-soft p-3 ">
                    {statusResult.errors.map((err, idx) => (
                      <p key={idx} className="text-xs text-tt-danger ">
                        {translateUi('Usuario')} {err.userId}: {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={async () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await confirmDialog.action();
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </AppShell>
  );
};

export default AdminBulkOperationsPage;
