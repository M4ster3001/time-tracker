import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import InfoTooltip from '../../../components/InfoTooltip';
import { SkeletonDashboard } from '../../../components/Skeleton';
import { extractApiError } from '../../../utils/formatters';
import {
  executeRetentionCleanup,
  fetchAdminRetentionStatus,
} from './services/adminRetention.service';
import type { RetentionStatus, HistoryEntry } from './types/adminRetention.types';

const AdminRetentionPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RetentionStatus | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [statusFallback, setStatusFallback] = useState(false);

  const fetchStatus = async () => {
    setError(null);
    try {
      const {
        status: normalizedStatus,
        history,
        missingFields,
      } = await fetchAdminRetentionStatus();
      setStatus(normalizedStatus);
      setStatusFallback(missingFields);
      setHistory(history);
    } catch (err) {
      setError(extractApiError(err, 'Falha ao carregar dados de retenção'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCleanup = async () => {
    if (!confirm('Confirmar execução da limpeza de retenção de dados?')) return;
    setCleaning(true);
    setCleanupMessage(null);
    try {
      const { totalDeleted, results } = await executeRetentionCleanup();
      setCleanupMessage(
        `Limpeza concluída: ${totalDeleted} registros removidos ` +
          `(${results.auditLogs} logs, ${results.expiredTokens} tokens expirados, ` +
          `${results.revokedTokens} tokens revogados, ${results.activityTags} tags)`
      );
      fetchStatus(); // Refresh data
    } catch (err) {
      setError(extractApiError(err, 'Falha ao executar limpeza'));
    } finally {
      setCleaning(false);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  return (
    <AppShell
      title={translateUi('Gestao de Retencao')}
      subtitle={translateUi('Politicas e limpeza de dados')}
    >
      {/* Controls */}
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loading || cleaning}
              className="rounded-2xl border border-tt-border bg-tt-surface px-4 py-2 text-sm font-semibold text-tt-warning disabled:opacity-50 "
            >
              {translateUi('Atualizar')}
            </button>
            <button
              type="button"
              onClick={handleCleanup}
              disabled={loading || cleaning || (status?.pendingCleanup.total ?? 0) === 0}
              className="rounded-2xl bg-tt-danger px-4 py-2 text-sm font-semibold text-tt-on-action disabled:opacity-50 dark:bg-tt-danger"
            >
              {cleaning ? 'Executando...' : 'Executar Limpeza Manual'}
            </button>
          </div>
          {status?.lastCleanup && (
            <p className="text-xs text-tt-text-muted">
              {translateUi('Ultima limpeza:')} {formatDate(status.lastCleanup.timestamp)}
            </p>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-3xl border border-tt-danger bg-tt-danger-soft p-4 text-sm text-tt-danger ">
          {error}
        </div>
      )}
      {statusFallback && (
        <div className="rounded-3xl border border-tt-border bg-tt-warning-soft p-4 text-sm text-tt-warning ">
          Alguns dados nao foram retornados pelo backend. Valores exibidos como 0 para manter a tela
          funcional.
        </div>
      )}

      {cleanupMessage && (
        <div className="rounded-3xl border border-tt-success bg-tt-success-soft p-4 text-sm text-tt-success ">
          {cleanupMessage}
        </div>
      )}

      {loading && !status ? (
        <SkeletonDashboard />
      ) : status ? (
        <>
          {/* Policy Configuration */}
          <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-tt-text">
                {translateUi('Politicas de Retencao')}
              </h3>
              <InfoTooltip content="Configuração atual de retenção de dados no sistema." />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Logs de Auditoria')}</p>
                <p className="text-2xl font-bold text-tt-text">{status.policy.auditLogsDays}</p>
                <p className="text-xs text-tt-text-muted">{translateUi('dias')}</p>
              </div>
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Tokens Expirados')}</p>
                <p className="text-2xl font-bold text-tt-text">{status.policy.expiredTokensDays}</p>
                <p className="text-xs text-tt-text-muted">{translateUi('dias apos expirar')}</p>
              </div>
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Tokens Revogados')}</p>
                <p className="text-2xl font-bold text-tt-text">{status.policy.revokedTokensDays}</p>
                <p className="text-xs text-tt-text-muted">{translateUi('dias apos revogar')}</p>
              </div>
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Tags Inativas')}</p>
                <p className="text-2xl font-bold text-tt-text">
                  {status.policy.unusedActivityTagsDays}
                </p>
                <p className="text-xs text-tt-text-muted">{translateUi('dias sem uso')}</p>
              </div>
            </div>
          </section>

          {/* Pending Cleanup */}
          <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-start gap-3">
                  <h3 className="text-lg font-semibold text-tt-text">
                    {translateUi('Dados Pendentes de Limpeza')}
                  </h3>
                  <InfoTooltip content="Registros que serão removidos na próxima limpeza." />
                </div>
              </div>
              <div
                className={`rounded-full px-4 py-2 text-lg font-bold ${
                  status.pendingCleanup.total > 0
                    ? 'bg-tt-elevated text-tt-warning '
                    : 'bg-tt-success-soft text-tt-success '
                }`}
              >
                {status.pendingCleanup.total}
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Logs de Auditoria')}</p>
                <p className="text-2xl font-bold text-tt-text">{status.pendingCleanup.auditLogs}</p>
              </div>
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Tokens Expirados')}</p>
                <p className="text-2xl font-bold text-tt-text">
                  {status.pendingCleanup.expiredTokens}
                </p>
              </div>
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Tokens Revogados')}</p>
                <p className="text-2xl font-bold text-tt-text">
                  {status.pendingCleanup.revokedTokens}
                </p>
              </div>
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Tags Inativas')}</p>
                <p className="text-2xl font-bold text-tt-text">
                  {status.pendingCleanup.activityTags}
                </p>
              </div>
            </div>
          </section>

          {/* Statistics */}
          <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-tt-text">
              {translateUi('Estatisticas Atuais')}
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Total de Logs')}</p>
                <p className="text-2xl font-bold text-tt-text">
                  {(status?.statistics?.totalAuditLogs ?? 0).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Total de Tokens')}</p>
                <p className="text-2xl font-bold text-tt-text">
                  {(status?.statistics?.totalTokens ?? 0).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Total de Tags')}</p>
                <p className="text-2xl font-bold text-tt-text">
                  {(status?.statistics?.totalActivityTags ?? 0).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </section>

          {/* Cleanup History */}
          <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-tt-text">
              {translateUi('Historico de Limpeza')}
            </h3>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-tt-text-muted">
                {translateUi('Nenhuma limpeza realizada ainda')}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-tt-border">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-tt-text">
                        {translateUi('Data')}
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-tt-text">
                        {translateUi('Acao')}
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-tt-text">Status</th>
                      <th className="px-4 py-2 text-left font-medium text-tt-text">
                        {translateUi('Executado por')}
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-tt-text">
                        {translateUi('Registros')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id} className="border-b border-tt-border">
                        <td className="px-4 py-3 text-tt-text-muted">
                          {formatDate(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3 text-tt-text">
                          {entry.action === 'DATA_RETENTION_CLEANUP'
                            ? 'Limpeza Automática'
                            : 'Limpeza Manual'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              entry.status === 'SUCCESS' || entry.status === 'COMPLETED'
                                ? 'bg-tt-success-soft text-tt-success '
                                : entry.status === 'INITIATED'
                                  ? 'bg-tt-info-soft text-tt-link '
                                  : 'bg-tt-danger-soft text-tt-danger '
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-tt-text-muted">{entry.triggeredBy}</td>
                        <td className="px-4 py-3 text-right text-tt-text-muted">
                          {entry.results
                            ? (entry.results.auditLogs ?? 0) +
                              (entry.results.expiredTokens ?? 0) +
                              (entry.results.revokedTokens ?? 0) +
                              (entry.results.activityTags ?? 0)
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
};

export default AdminRetentionPage;
