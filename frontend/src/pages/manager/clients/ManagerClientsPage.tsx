import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import Pagination from '../../../components/Pagination';
import api from '../../../services/api';

interface ClientRow {
  id: number;
  name: string;
  code: string;
  lockDay: number | null;
}

const ManagerClientsPage: React.FC = () => {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/manager/clients');
      setClients(response.data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    if (!search) return clients;
    const term = search.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(term) || client.code.toLowerCase().includes(term)
    );
  }, [clients, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [filteredClients.length, pageSize, page]);

  const paginatedClients = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, page, pageSize]);

  const handleLockDayChange = async (clientId: number, value: string) => {
    const nextValue = value === '' ? null : Number(value);
    if (nextValue !== null && (!Number.isFinite(nextValue) || nextValue < 1 || nextValue > 31)) {
      setError('Lock day deve estar entre 1 e 31');
      return;
    }

    try {
      await api.patch(`/api/manager/clients/${clientId}/lock-day`, {
        lockDay: nextValue,
      });
      setClients((prev) =>
        prev.map((client) => (client.id === clientId ? { ...client, lockDay: nextValue } : client))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar lock day');
    }
  };

  return (
    <AppShell
      title={translateUi('Fechamento de horas')}
      subtitle={translateUi('Defina o dia limite por cliente')}
    >
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={translateUi('Buscar cliente')}
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          />
        </div>
      </section>

      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-tt-text-muted">{translateUi('Carregando...')}</p>
        ) : error ? (
          <p className="text-sm text-tt-danger">{error}</p>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 md:max-h-[70vh]">
            {paginatedClients.map((client) => (
              <div
                key={client.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-tt border border-tt-border bg-tt-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-tt-text">{client.name}</p>
                  <p className="text-xs text-tt-text-muted">{client.code}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-tt-text-muted">
                  <span className="uppercase tracking-[0.2em] text-tt-warning">
                    {translateUi('Fechamento')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={client.lockDay ?? ''}
                    onChange={(event) => handleLockDayChange(client.id, event.target.value)}
                    className="w-20 rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error ? (
          <Pagination
            total={filteredClients.length}
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

export default ManagerClientsPage;
