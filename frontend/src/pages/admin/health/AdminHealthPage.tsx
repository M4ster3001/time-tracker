import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { SkeletonDashboard } from '../../../components/Skeleton';
import StateBanner from '../../../components/StateBanner';
import { extractApiError } from '../../../utils/formatters';
import { fetchAdminHealth } from './services/adminHealth.service';
import type { HealthStatus } from './types/adminHealth.types';

const AdminHealthPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchHealth = async () => {
    setError(null);
    try {
      setHealth(await fetchAdminHealth());
    } catch (err) {
      setError(extractApiError(err, 'Falha ao carregar status'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return 'text-tt-success ';
      case 'degraded':
      case 'warning':
        return 'text-tt-warning ';
      case 'unhealthy':
      case 'error':
        return 'text-tt-danger ';
      default:
        return 'text-tt-text-muted';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return 'bg-tt-success-soft border-tt-success ';
      case 'degraded':
      case 'warning':
        return 'bg-tt-elevated border-tt-border ';
      case 'unhealthy':
      case 'error':
        return 'bg-tt-danger-soft border-tt-danger ';
      default:
        return 'bg-tt-elevated border-tt-border';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-tt-danger bg-tt-danger-soft ';
      case 'warning':
        return 'text-tt-warning bg-tt-elevated ';
      case 'info':
        return 'text-tt-link bg-tt-info-soft ';
      default:
        return 'text-tt-text-muted bg-tt-elevated';
    }
  };

  return (
    <AppShell
      title={translateUi('Status do Sistema')}
      subtitle={translateUi('Monitoramento e saude da aplicacao')}
    >
      {/* Controls */}
      <section className="w-full min-w-0 rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={fetchHealth}
              disabled={loading}
              className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action disabled:opacity-50 "
            >
              {loading ? 'Atualizando...' : translateUi('Atualizar')}
            </button>
            <label className="flex items-center gap-2 text-sm text-tt-text">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4"
              />
              {translateUi('Auto-refresh (30s)')}
            </label>
          </div>
          {health && (
            <p
              className={`text-xs ${
                health.status === 'unhealthy'
                  ? 'font-semibold text-tt-danger'
                  : 'text-tt-text-muted'
              } break-words`}
            >
              {translateUi('Ultima verificacao:')}{' '}
              {new Date(health.timestamp).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      </section>

      {error ? <StateBanner tone="error" message={error} /> : null}

      {loading && !health ? (
        <SkeletonDashboard />
      ) : health ? (
        <>
          {/* Overall Status */}
          <section
            className={`w-full min-w-0 rounded-3xl border p-6 ${getStatusBg(health.status)}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className={`text-2xl font-bold ${getStatusColor(health.status)}`}>
                  {health.status === 'healthy'
                    ? 'Sistema Saudavel'
                    : health.status === 'degraded'
                      ? 'Sistema Degradado'
                      : 'Sistema com Problemas'}
                </h3>
                <p className="mt-1 break-words text-sm text-tt-text-muted">
                  {translateUi('Versao')} {health.version} · Uptime: {formatUptime(health.uptime)}
                </p>
                {health.summary ? (
                  <p className="mt-1 break-words text-sm text-tt-text-muted">{health.summary}</p>
                ) : null}
              </div>
              <div className="min-w-0 flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-4 py-2 text-lg font-bold ${getStatusColor(
                    health.status
                  )}`}
                >
                  {health.status === 'healthy' ? '✓' : health.status === 'degraded' ? '⚠' : '✗'}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getStatusBg(
                    health.status
                  )}`}
                >
                  {health.status}
                </span>
                {health.httpStatus ? (
                  <span className="rounded-full border border-tt-border bg-tt-surface px-3 py-1 text-xs font-semibold text-tt-warning">
                    HTTP {health.httpStatus}
                  </span>
                ) : null}
              </div>
            </div>
          </section>
          {health.recommendations && health.recommendations.length > 0 && (
            <section className="w-full min-w-0 rounded-tt border border-tt-border bg-tt-surface p-6 text-sm text-tt-text shadow-sm">
              <h3 className="text-lg font-semibold text-tt-text">{translateUi('Recomendacoes')}</h3>
              <ul className="mt-3 space-y-2">
                {health.recommendations.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-start gap-2">
                    <span className="mt-0.5 text-tt-warning">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Alerts */}
          {health.alerts.length > 0 && (
            <section className="w-full min-w-0 rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-tt-text">{translateUi('Alertas')}</h3>
              <div className="mt-4 space-y-2">
                {health.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 ${getSeverityColor(alert.severity)}`}
                  >
                    <span className="text-lg">
                      {alert.severity === 'critical'
                        ? '🚨'
                        : alert.severity === 'warning'
                          ? '⚠️'
                          : 'ℹ️'}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs opacity-75">
                        {new Date(alert.timestamp).toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* System Checks */}
          <section className="w-full min-w-0 rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-tt-text">
              {translateUi('Verificacoes do Sistema')}
            </h3>
            <div className="mt-4 overflow-x-auto">
              <div className="flex min-w-max flex-wrap gap-2 md:min-w-0">
                {Object.entries(health.checks).map(([name, check]) => (
                  <span
                    key={`badge-${name}`}
                    title={check.message}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBg(
                      check.status
                    )} ${getStatusColor(check.status)}`}
                  >
                    {name.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {Object.entries(health.checks).map(([name, check]) => (
                <div
                  key={name}
                  className={`min-w-0 rounded-xl border p-4 ${getStatusBg(check.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold capitalize text-tt-text">{name}</p>
                    <span className={`text-lg ${getStatusColor(check.status)}`}>
                      {check.status === 'ok' ? '✓' : check.status === 'warning' ? '⚠' : '✗'}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs text-tt-text-muted">{check.message}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Metrics */}
          <section className="w-full min-w-0 rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-tt-text">{translateUi('Metricas')}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <div className="min-w-0 rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Usuarios')}</p>
                <p className="text-2xl font-bold text-tt-text">
                  {health.metrics.activeUsers}
                  <span className="text-sm font-normal text-tt-text-muted">
                    {' '}
                    / {health.metrics.totalUsers}
                  </span>
                </p>
                <p className="text-xs text-tt-text-muted">{translateUi('ativos')}</p>
              </div>
              <div className="min-w-0 rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Clientes')}</p>
                <p className="text-2xl font-bold text-tt-text">
                  {health.metrics.activeClients}
                  <span className="text-sm font-normal text-tt-text-muted">
                    {' '}
                    / {health.metrics.totalClients}
                  </span>
                </p>
                <p className="text-xs text-tt-text-muted">{translateUi('ativos')}</p>
              </div>
              <div className="min-w-0 rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Lancamentos (24h)')}</p>
                <p className="text-2xl font-bold text-tt-text">
                  {health.metrics.timeEntriesLast24h}
                </p>
                <p className="text-xs text-tt-text-muted">
                  {translateUi('de')} {health.metrics.totalTimeEntries}
                  {translateUi('total')}
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Taxa de Erro (24h)')}</p>
                <p
                  className={`text-2xl font-bold ${health.metrics.errorRateLast24h > 5 ? 'text-tt-danger ' : 'text-tt-success '}`}
                >
                  {health.metrics.errorRateLast24h.toFixed(1)}%
                </p>
              </div>
            </div>
          </section>

          {/* Recent Errors */}
          {health.metrics.recentErrors.length > 0 && (
            <section className="w-full min-w-0 rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-tt-text">
                {translateUi('Erros Recentes (24h)')}
              </h3>
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                {health.metrics.recentErrors.map((err, idx) => (
                  <div
                    key={idx}
                    className="min-w-0 rounded-xl border border-tt-danger bg-tt-danger-soft px-4 py-3 "
                  >
                    <div className="flex items-center justify-between">
                      <p className="min-w-0 break-words text-sm font-medium text-tt-danger ">
                        {err.endpoint}
                      </p>
                      <p className="text-xs text-tt-danger ">
                        {new Date(err.timestamp).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-tt-danger ">{err.action}</p>
                    {err.details && (
                      <p className="mt-1 break-words text-xs text-tt-danger ">{err.details}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
    </AppShell>
  );
};

export default AdminHealthPage;
