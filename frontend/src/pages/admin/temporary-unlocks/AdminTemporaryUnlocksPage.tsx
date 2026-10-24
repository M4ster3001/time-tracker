import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import InfoTooltip from '../../../components/InfoTooltip';
import { SkeletonDashboard } from '../../../components/Skeleton';
import { extractApiError } from '../../../utils/formatters';
import {
  fetchAdminTemporaryUnlockDetails,
  fetchAdminTemporaryUnlockOptions,
  fetchAdminTemporaryUnlocks,
  grantAdminTemporaryUnlock,
  revokeAdminTemporaryUnlock,
} from './services/adminTemporaryUnlocks.service';
import type {
  ClientOption,
  TemporaryUnlock,
  UnlockDetails,
  UserOption,
} from './types/adminTemporaryUnlocks.types';

const AdminTemporaryUnlocksPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocks, setUnlocks] = useState<TemporaryUnlock[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);

  // Grant form
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [formUserId, setFormUserId] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formYear, setFormYear] = useState(new Date().getFullYear().toString());
  const [formMonth, setFormMonth] = useState((new Date().getMonth() + 1).toString());
  const [formReason, setFormReason] = useState('');
  const [formHours, setFormHours] = useState('24');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Details modal
  const [details, setDetails] = useState<UnlockDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchUnlocks = async () => {
    setError(null);
    try {
      setUnlocks(await fetchAdminTemporaryUnlocks(activeOnly));
    } catch (err) {
      setError(extractApiError(err, 'Falha ao carregar desbloqueios'));
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const { users: userOptions, clients: clientOptions } =
        await fetchAdminTemporaryUnlockOptions();
      setUsers(userOptions);
      setClients(clientOptions);
    } catch {
      // Options are not critical
    }
  };

  useEffect(() => {
    fetchUnlocks();
  }, [activeOnly]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await grantAdminTemporaryUnlock({
        userId: Number(formUserId),
        clientId: Number(formClientId),
        periodYear: Number(formYear),
        periodMonth: Number(formMonth),
        reason: formReason,
        durationHours: Number(formHours),
      });
      setShowForm(false);
      setFormReason('');
      setFormUserId('');
      setFormClientId('');
      fetchUnlocks();
    } catch (err) {
      setFormError(extractApiError(err, 'Falha ao conceder desbloqueio'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm('Revogar este desbloqueio temporário?')) return;
    try {
      await revokeAdminTemporaryUnlock(id);
      fetchUnlocks();
    } catch (err) {
      setError(extractApiError(err, 'Falha ao revogar'));
    }
  };

  const handleViewDetails = async (id: number) => {
    try {
      setDetails(await fetchAdminTemporaryUnlockDetails(id));
      setShowDetails(true);
    } catch (err) {
      setError(extractApiError(err, 'Falha ao carregar detalhes'));
    }
  };

  const getStatus = (unlock: TemporaryUnlock) => {
    if (unlock.revokedAt) return 'revoked';
    if (new Date(unlock.expiresAt) <= new Date()) return 'expired';
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-tt-success-soft text-tt-success ';
      case 'expired':
        return 'bg-tt-elevated text-tt-text-muted';
      case 'revoked':
        return 'bg-tt-danger-soft text-tt-danger ';
      default:
        return 'bg-tt-elevated text-tt-text-muted';
    }
  };

  const formatPeriod = (year: number, month: number) => {
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    return `${months[month - 1]} ${year}`;
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  return (
    <AppShell
      title={translateUi('Desbloqueio Temporario')}
      subtitle={translateUi('Gerenciar acessos temporarios para edicao de periodos bloqueados')}
    >
      {/* Controls */}
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action "
            >
              {translateUi('Conceder Desbloqueio')}
            </button>
            <label className="flex items-center gap-2 text-sm text-tt-text">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="h-4 w-4"
              />
              {translateUi('Apenas ativos')}
            </label>
          </div>
          <button
            type="button"
            onClick={fetchUnlocks}
            className="rounded-2xl border border-tt-border bg-tt-surface px-4 py-2 text-sm font-semibold text-tt-warning transition hover:bg-tt-warning-soft "
          >
            {translateUi('Atualizar')}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-3xl border border-tt-danger bg-tt-danger-soft p-4 text-sm text-tt-danger ">
          {error}
        </div>
      )}

      {/* Grant Form Modal */}
      {showForm && (
        <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-tt-text">
              {translateUi('Conceder Desbloqueio Temporario')}
            </h3>
            <InfoTooltip content="O usuário poderá editar lançamentos do período selecionado pelo tempo definido, com máximo de 24h. Todas as edições serão auditadas." />
          </div>
          <form onSubmit={handleGrant} className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-tt-text">
                {translateUi('Usuario')}
              </label>
              <select
                value={formUserId}
                onChange={(e) => setFormUserId(e.target.value)}
                required
                className="w-full rounded-xl border border-tt-border bg-tt-surface px-3 py-2 text-sm"
              >
                <option value="">{translateUi('Selecionar...')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-tt-text">
                {translateUi('Cliente')}
              </label>
              <select
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                required
                className="w-full rounded-xl border border-tt-border bg-tt-surface px-3 py-2 text-sm"
              >
                <option value="">{translateUi('Selecionar...')}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-tt-text">
                {translateUi('Ano')}
              </label>
              <input
                type="number"
                value={formYear}
                onChange={(e) => setFormYear(e.target.value)}
                required
                min={2000}
                max={2100}
                className="w-full rounded-xl border border-tt-border bg-tt-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-tt-text">
                {translateUi('Mes')}
              </label>
              <select
                value={formMonth}
                onChange={(e) => setFormMonth(e.target.value)}
                required
                className="w-full rounded-xl border border-tt-border bg-tt-surface px-3 py-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {formatPeriod(Number(formYear), i + 1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-tt-text">
                {translateUi('Duracao (horas, max 24)')}
              </label>
              <input
                type="number"
                value={formHours}
                onChange={(e) => setFormHours(e.target.value)}
                required
                min={1}
                max={24}
                className="w-full rounded-xl border border-tt-border bg-tt-surface px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-tt-text">
                {translateUi('Motivo')}
              </label>
              <textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                required
                minLength={5}
                rows={2}
                placeholder={translateUi('Descreva o motivo do desbloqueio...')}
                className="w-full rounded-xl border border-tt-border bg-tt-surface px-3 py-2 text-sm"
              />
            </div>
            {formError && <div className="text-sm text-tt-danger md:col-span-2">{formError}</div>}
            <div className="flex gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl bg-tt-action px-6 py-2 text-sm font-semibold text-tt-on-action disabled:opacity-50 "
              >
                {submitting ? 'Concedendo...' : 'Conceder'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-2xl border border-tt-border bg-tt-surface px-6 py-2 text-sm font-semibold text-tt-text"
              >
                {translateUi('Cancelar')}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Unlocks List */}
      {loading ? (
        <SkeletonDashboard />
      ) : unlocks.length === 0 ? (
        <section className="rounded-tt border border-tt-border bg-tt-surface p-6 text-center text-sm text-tt-text-muted shadow-sm">
          {translateUi('Nenhum desbloqueio temporario encontrado')}
        </section>
      ) : (
        <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tt-border text-left text-xs uppercase tracking-wide text-tt-text-muted">
                  <th className="px-3 py-2">{translateUi('Usuario')}</th>
                  <th className="px-3 py-2">{translateUi('Cliente')}</th>
                  <th className="px-3 py-2">{translateUi('Periodo')}</th>
                  <th className="px-3 py-2">{translateUi('Expira')}</th>
                  <th className="px-3 py-2">{translateUi('Concedido por')}</th>
                  <th className="px-3 py-2">{translateUi('Edicoes')}</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">{translateUi('Acoes')}</th>
                </tr>
              </thead>
              <tbody>
                {unlocks.map((unlock) => {
                  const status = getStatus(unlock);
                  return (
                    <tr key={unlock.id} className="border-b border-tt-border">
                      <td className="px-3 py-3 font-medium text-tt-text">{unlock.userName}</td>
                      <td className="px-3 py-3 text-tt-text-muted">{unlock.clientName}</td>
                      <td className="px-3 py-3 text-tt-text-muted">
                        {formatPeriod(unlock.periodYear, unlock.periodMonth)}
                      </td>
                      <td className="px-3 py-3 text-xs text-tt-text-muted">
                        {formatDateTime(unlock.expiresAt)}
                      </td>
                      <td className="px-3 py-3 text-tt-text-muted">{unlock.adminName}</td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${unlock.editCount > 0 ? 'bg-tt-elevated text-tt-warning ' : 'bg-tt-elevated text-tt-text-muted'}`}
                        >
                          {unlock.editCount}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${getStatusBadge(status)}`}
                        >
                          {status === 'active'
                            ? translateUi('Ativo')
                            : status === 'expired'
                              ? 'Expirado'
                              : 'Revogado'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(unlock.id)}
                            className="rounded-xl border border-tt-border px-3 py-1 text-xs font-medium text-tt-warning transition hover:bg-tt-warning-soft "
                          >
                            {translateUi('Detalhes')}
                          </button>
                          {status === 'active' && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(unlock.id)}
                              className="rounded-xl border border-tt-danger px-3 py-1 text-xs font-medium text-tt-danger transition hover:bg-tt-danger-soft "
                            >
                              {translateUi('Revogar')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Details Modal */}
      {showDetails && details && (
        <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-tt-text">
              {translateUi('Detalhes do Desbloqueio #')} {details.id}
            </h3>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="text-sm text-tt-text-muted hover:text-tt-text"
            >
              {translateUi('Fechar')}
            </button>
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <span className="text-tt-text-muted">{translateUi('Usuario:')}</span>{' '}
              <span className="font-medium text-tt-text">{details.userName}</span>
            </div>
            <div>
              <span className="text-tt-text-muted">{translateUi('Cliente:')}</span>{' '}
              <span className="font-medium text-tt-text">{details.clientName}</span>
            </div>
            <div>
              <span className="text-tt-text-muted">{translateUi('Periodo:')}</span>{' '}
              <span className="font-medium text-tt-text">
                {formatPeriod(details.periodYear, details.periodMonth)}
              </span>
            </div>
            <div>
              <span className="text-tt-text-muted">{translateUi('Concedido por:')}</span>{' '}
              <span className="font-medium text-tt-text">{details.adminName}</span>
            </div>
            <div>
              <span className="text-tt-text-muted">{translateUi('Criado em:')}</span>{' '}
              {formatDateTime(details.createdAt)}
            </div>
            <div>
              <span className="text-tt-text-muted">{translateUi('Expira em:')}</span>{' '}
              {formatDateTime(details.expiresAt)}
            </div>
            <div className="md:col-span-2">
              <span className="text-tt-text-muted">{translateUi('Motivo:')}</span>{' '}
              <span className="text-tt-text">{details.reason}</span>
            </div>
          </div>

          {/* Edits */}
          <h4 className="mt-6 text-sm font-semibold text-tt-text">
            {translateUi('Edicoes Realizadas (')} {details.edits.length})
          </h4>

          {details.edits.length === 0 ? (
            <p className="mt-2 text-xs text-tt-text-muted">
              {translateUi('Nenhuma edicao realizada durante este desbloqueio.')}
            </p>
          ) : (
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {details.edits.map((edit) => (
                <div
                  key={edit.id}
                  className="rounded-xl border border-tt-border bg-tt-warning-soft/50 p-3/50"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        edit.action === 'CREATE'
                          ? 'bg-tt-success-soft text-tt-success '
                          : edit.action === 'DELETE'
                            ? 'bg-tt-danger-soft text-tt-danger '
                            : 'bg-tt-info-soft text-tt-link '
                      }`}
                    >
                      {edit.action}
                    </span>
                    <span className="text-xs text-tt-text-muted">
                      {formatDateTime(edit.createdAt)}
                    </span>
                  </div>
                  {edit.timeEntryId && (
                    <p className="mt-1 text-xs text-tt-text-muted">
                      Time Entry #{edit.timeEntryId}
                    </p>
                  )}
                  {edit.previousData && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-tt-danger ">{translateUi('Antes:')}</p>
                      <pre className="mt-1 rounded bg-tt-danger-soft p-2 text-xs text-tt-danger ">
                        {JSON.stringify(edit.previousData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {edit.newData && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-tt-success ">
                        {translateUi('Depois:')}
                      </p>
                      <pre className="mt-1 rounded bg-tt-success-soft p-2 text-xs text-tt-action ">
                        {JSON.stringify(edit.newData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
};

export default AdminTemporaryUnlocksPage;
