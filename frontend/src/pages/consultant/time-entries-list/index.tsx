import { text, translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import ConfirmDialog from '../../../components/ConfirmDialog';
import Pagination from '../../../components/Pagination';
import SearchableSelect from '../../../components/SearchableSelect';
import api from '../../../services/api';
import { formatDate, formatMinutes, monthOptions } from '../../../utils/formatters';
import { useAuth } from '../../../contexts/AuthContext';
import {
  timeEntriesListBodyClass,
  timeEntriesListEmptyClass,
  timeEntriesListEntryClass,
  timeEntriesListFilterClusterClass,
  timeEntriesListFiltersClass,
  timeEntriesListFooterClass,
  timeEntriesListPageStackClass,
  timeEntriesListPanelClass,
  timeEntriesListSelectClass,
  timeEntriesListTotalClass,
} from './styles/timeEntriesList.styles';

interface ClientOption {
  id: number;
  name: string;
  historicalOnly?: boolean;
}

interface TimeEntry {
  id: number;
  clientId: number;
  date: string;
  activityDescription: string;
  durationMinutes: number;
  source?: 'PORTAL' | 'API';
}

const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

const TimeEntriesListPage: React.FC = () => {
  const now = new Date();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [clientId, setClientId] = useState<number>(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lockStatus, setLockStatus] = useState<{
    locked: boolean;
    lockDay: number;
    temporaryUnlock?: boolean;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    entryId: number | null;
    title: string;
  }>({ isOpen: false, entryId: null, title: '' });

  const years = useMemo(() => [year - 1, year, year + 1], [year]);
  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients]
  );
  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients]
  );

  useEffect(() => {
    const fetchClients = async () => {
      if (!user) return;
      try {
        const response = await api.get(`/api/users/${user.id}/clients`, {
          params: { year, month },
        });
        setClients(response.data.data || []);
      } catch (_err) {
        setClients([]);
      }
    };
    fetchClients();
  }, [user?.id, year, month]);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/time-entries', {
        params: { month, year, clientId: clientId || undefined },
      });
      setEntries(response.data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar lançamentos');
    } finally {
      setLoading(false);
    }
  };

  const fetchLockStatus = async () => {
    try {
      const response = await api.get('/api/time-entries/lock-status', {
        params: { month, year, clientId: clientId || undefined },
      });
      setLockStatus(response.data.data);
    } catch (_err) {
      setLockStatus(null);
    }
  };

  useEffect(() => {
    fetchEntries();
    fetchLockStatus();
  }, [month, year, clientId]);

  useEffect(() => {
    setClientId(0);
  }, [year, month]);

  useEffect(() => {
    setPage(1);
  }, [year, month, clientId, search]);

  const visibleEntries = useMemo(() => {
    const term = normalizeSearch(search);
    if (!term) return entries;
    return entries.filter((entry) =>
      normalizeSearch(
        `${entry.activityDescription} ${clientNameById.get(entry.clientId) ?? ''}`
      ).includes(term)
    );
  }, [entries, search, clientNameById]);
  const isSearching = search.trim().length > 0;
  const totalMinutes = visibleEntries.reduce((acc, entry) => acc + entry.durationMinutes, 0);
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleEntries.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [visibleEntries.length, pageSize, page]);

  const handleDelete = async () => {
    if (!deleteConfirm.entryId) return;
    await api.delete(`/api/time-entries/${deleteConfirm.entryId}`);
    setDeleteConfirm({ isOpen: false, entryId: null, title: '' });
    fetchEntries();
  };

  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleEntries.slice(start, start + pageSize);
  }, [visibleEntries, page, pageSize]);

  return (
    <AppShell
      title={translateUi('Historico')}
      subtitle={translateUi('Acompanhe os lancamentos do mes')}
    >
      <div className={timeEntriesListPageStackClass}>
        <section className={timeEntriesListPanelClass} aria-label={translateUi('Filtros')}>
          <div className={timeEntriesListFiltersClass}>
            <div className={timeEntriesListFilterClusterClass}>
              <label htmlFor="historico-year" className="sr-only">
                {translateUi('Selecionar ano')}
              </label>
              <select
                id="historico-year"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className={timeEntriesListSelectClass}
                aria-label={translateUi('Selecionar ano')}
              >
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <label htmlFor="historico-month" className="sr-only">
                {translateUi('Selecionar mes')}
              </label>
              <select
                id="historico-month"
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className={timeEntriesListSelectClass}
                aria-label={translateUi('Selecionar mes')}
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <SearchableSelect
              value={clientId}
              onChange={(value) => setClientId(Number(value))}
              className="min-w-[240px]"
              options={[
                { value: 0, label: translateUi('Todos os clientes') },
                ...clients.map((client) => ({
                  value: client.id,
                  label: `${client.name}${client.historicalOnly ? text('(histórico)', '(historical)') : ''}`,
                })),
              ]}
              placeholder={translateUi('Todos os clientes')}
              searchPlaceholder={translateUi('Buscar cliente...')}
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={text('Buscar na descrição ou cliente', 'Search description or client')}
              aria-label={text('Buscar lançamentos', 'Search entries')}
              className={`${timeEntriesListSelectClass} min-w-[220px] flex-1`}
            />
          </div>
        </section>

        <section className={`${timeEntriesListPanelClass} flex flex-col gap-6`}>
          <div className={timeEntriesListBodyClass}>
            {loading ? (
              <p className="text-sm text-tt-text-muted">{translateUi('Carregando...')}</p>
            ) : error ? (
              <p className="text-sm text-tt-danger">{error}</p>
            ) : visibleEntries.length === 0 ? (
              <div className={`${timeEntriesListEmptyClass} flex flex-col items-center gap-3`}>
                <p>
                  {isSearching
                    ? text('Nenhum lançamento corresponde à busca.', 'No entries match your search.')
                    : translateUi('Sem lancamentos neste periodo.')}
                </p>
                {isSearching ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="rounded-full border border-tt-border px-4 py-2 text-xs font-semibold text-tt-link hover:bg-tt-elevated"
                  >
                    {text('Limpar busca', 'Clear search')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/time-entries/new')}
                    className="rounded-full bg-tt-action px-4 py-2 text-xs font-semibold text-tt-on-action"
                  >
                    {text('Lançar horas', 'Log time')}
                  </button>
                )}
              </div>
            ) : (
              <div className="max-h-[60vh] w-full space-y-3 overflow-y-auto pr-1 md:max-h-[70vh]">
                {paginatedEntries.map((entry) => (
                  <div key={entry.id} className={timeEntriesListEntryClass}>
                    <div>
                      <p
                        className="max-w-[200px] truncate text-sm font-semibold text-tt-text md:max-w-[320px]"
                        title={entry.activityDescription}
                      >
                        {entry.activityDescription}
                      </p>
                      <p className="text-xs text-tt-text-muted">
                        {formatDate(entry.date)} ·{' '}
                        <span
                          className="inline-block max-w-[160px] truncate align-bottom md:max-w-[240px]"
                          title={
                            clientNameById.get(entry.clientId) ?? `Cliente #${entry.clientId}`
                          }
                        >
                          {clientNameById.get(entry.clientId) ?? `Cliente #${entry.clientId}`}
                        </span>
                        {clientById.get(entry.clientId)?.historicalOnly ? (
                          <span className="ml-2 rounded-tt bg-tt-elevated px-2 py-1 text-xs font-semibold text-tt-warning">
                            {translateUi('historico/desvinculado')}
                          </span>
                        ) : null}
                        {entry.source === 'API' ? (
                          <span className="ml-2 rounded-tt bg-tt-info-soft px-2 py-1 text-xs font-semibold uppercase tracking-wide text-tt-info">
                            {translateUi('Via API')}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-tt-action">
                        {formatMinutes(entry.durationMinutes)}
                      </span>
                      {lockStatus?.locked && !lockStatus?.temporaryUnlock ? null : (
                        <>
                          <button
                            type="button"
                            onClick={() => navigate(`/time-entries/${entry.id}/edit`)}
                            className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning hover:bg-tt-warning-soft"
                          >
                            {translateUi('Editar')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                isOpen: true,
                                entryId: entry.id,
                                title: entry.activityDescription,
                              })
                            }
                            className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning hover:bg-tt-warning-soft"
                          >
                            {translateUi('Excluir')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loading && !error && visibleEntries.length > 0 ? (
              <Pagination
                total={visibleEntries.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            ) : null}
          </div>

          <footer className={timeEntriesListFooterClass}>
            <div className={timeEntriesListTotalClass}>
              {isSearching ? text('Total da busca:', 'Search total:') : translateUi('Total do mes:')}{' '}
              {formatMinutes(totalMinutes)}
            </div>
            {lockStatus?.locked && !lockStatus?.temporaryUnlock ? (
              <div className="rounded-2xl border border-tt-border bg-tt-warning-soft px-4 py-3 text-xs font-semibold text-tt-warning">
                {text('Fechamento ativo. Edições do mês selecionado estão bloqueadas.', 'Month close is active. Edits for the selected month are locked.')}
              </div>
            ) : null}
            {lockStatus?.locked && lockStatus?.temporaryUnlock ? (
              <div className="rounded-2xl border border-tt-success bg-tt-success-soft px-4 py-3 text-xs font-semibold text-tt-success">
                {text('Fechamento ativo, mas com desbloqueio temporário para correção.', 'Month close is active, with a temporary unlock for corrections.')}
              </div>
            ) : null}
            {clientId !== 0 && clientById.get(clientId)?.historicalOnly ? (
              <div className="rounded-2xl border border-tt-border bg-tt-warning-soft px-4 py-3 text-xs font-semibold text-tt-warning">
                {translateUi(
                  'Cliente historico/desvinculado: voce pode consultar e exportar lancamentos antigos.'
                )}
              </div>
            ) : null}
          </footer>
        </section>
      </div>
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={translateUi('Excluir lancamento')}
        message={`Tem certeza que deseja excluir "${deleteConfirm.title}"? Esta ação não pode ser desfeita.`}
        confirmLabel={translateUi('Excluir')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, entryId: null, title: '' })}
      />
    </AppShell>
  );
};

export default TimeEntriesListPage;
