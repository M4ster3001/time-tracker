import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import Pagination from '../../../components/Pagination';
import { formatDate } from '../../../utils/formatters';
import { fetchAuditLogs } from './services/auditLogs.service';
import type { AuditLogRow } from './types/auditLogs.types';

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const loadAuditLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        setLogs(await fetchAuditLogs(userId, action));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar logs');
      } finally {
        setLoading(false);
      }
    };

    void loadAuditLogs();
  }, [userId, action]);

  useEffect(() => {
    setPage(1);
  }, [userId, action]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [logs.length, pageSize, page]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return logs.slice(start, start + pageSize);
  }, [logs, page, pageSize]);

  return (
    <AppShell
      title={translateUi('Auditoria')}
      subtitle={translateUi('Acompanhe os logs do sistema')}
    >
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder={translateUi('Filtrar por usuario ID')}
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          />
          <input
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder={translateUi('Filtrar por acao')}
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          />
        </div>
      </section>

      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-tt-text-muted">{translateUi('Carregando...')}</p>
        ) : error ? (
          <p className="text-sm text-tt-danger">{error}</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-tt-text-muted">{translateUi('Nenhum log encontrado.')}</p>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 md:max-h-[70vh]">
            {paginatedLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-tt border border-tt-border bg-tt-surface px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-tt-text">{log.action}</p>
                    <p className="text-xs text-tt-text-muted">
                      {formatDate(log.createdAt)} · {log.endpoint}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      log.status === 'success'
                        ? 'bg-tt-success-soft text-tt-success'
                        : 'bg-tt-danger-soft text-tt-danger'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
                {log.details ? (
                  <p className="mt-2 text-xs text-tt-text-muted">{log.details}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {!loading && !error ? (
          <Pagination
            total={logs.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </section>
    </AppShell>
  );
};

export default AuditLogsPage;
