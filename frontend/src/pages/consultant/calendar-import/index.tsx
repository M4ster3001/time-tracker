import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useState, useCallback } from 'react';
import AppShell from '../../../components/AppShell';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

interface ClientOption {
  id: number;
  name: string;
}

interface CalendarEvent {
  googleEventId: string;
  summary: string;
  startDateTime: string;
  endDateTime: string;
  date: string;
  durationMinutes: number;
  alreadyImported: boolean;
}

interface ImportRow extends CalendarEvent {
  selected: boolean;
  clientId: number;
  activityDescription: string;
  editedDuration: number;
}

type ConnectionStatus =
  | { connected: false }
  | { connected: true; calendarEmail: string; id: number };

type PageStatus = 'idle' | 'loading' | 'fetching' | 'importing' | 'success' | 'error';

const CalendarImportPage: React.FC = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  // Date range
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Events
  const [rows, setRows] = useState<ImportRow[]>([]);

  // Check connection status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [statusRes, clientsRes] = await Promise.all([
          api.get('/api/google-calendar/status'),
          user
            ? api.get(`/api/users/${user.id}/clients`, {
                params: { includeHistorical: false },
              })
            : Promise.resolve({ data: { data: [] } }),
        ]);
        setConnectionStatus(statusRes.data.data);
        setClients(clientsRes.data.data || []);
        setStatus('idle');
      } catch {
        setConnectionStatus({ connected: false });
        setStatus('idle');
      }
    };

    // Handle redirect from OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')) {
      setError(`Falha na autenticacao: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }

    checkStatus();
  }, [user?.id]);

  const handleConnect = async () => {
    try {
      const res = await api.get('/api/google-calendar/auth-url');
      window.location.href = res.data.data.url;
    } catch {
      setError('Falha ao iniciar conexão com Google');
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/api/google-calendar/disconnect');
      setConnectionStatus({ connected: false });
      setRows([]);
    } catch {
      setError('Falha ao desconectar');
    }
  };

  const handleFetchEvents = useCallback(async () => {
    setStatus('fetching');
    setError(null);
    try {
      const res = await api.get('/api/google-calendar/events', {
        params: { startDate, endDate },
      });
      const events: CalendarEvent[] = res.data.data || [];
      const defaultClientId = clients.length > 0 ? clients[0].id : 0;
      setRows(
        events.map((evt) => ({
          ...evt,
          selected: !evt.alreadyImported,
          clientId: defaultClientId,
          activityDescription: evt.summary,
          editedDuration: evt.durationMinutes,
        }))
      );
      setStatus('idle');
    } catch (err: unknown) {
      setStatus('error');
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'Falha ao buscar eventos';
      setError(String(msg));
    }
  }, [startDate, endDate, clients]);

  const updateRow = (index: number, patch: Partial<ImportRow>) => {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const toggleAll = (checked: boolean) => {
    setRows((prev) =>
      prev.map((row) => (row.alreadyImported ? row : { ...row, selected: checked }))
    );
  };

  const selectedRows = rows.filter((r) => r.selected && !r.alreadyImported);

  const handleImport = async () => {
    if (selectedRows.length === 0) return;
    setStatus('importing');
    setError(null);

    try {
      const entries = selectedRows.map((row) => ({
        googleEventId: row.googleEventId,
        clientId: row.clientId,
        date: row.date,
        activityDescription: row.activityDescription,
        durationMinutes: row.editedDuration,
      }));
      await api.post('/api/google-calendar/import', { entries });
      setImportedCount(entries.length);
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'Falha ao importar';
      setError(String(msg));
    }
  };

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // --- Not connected state ---
  if (status === 'loading') {
    return (
      <AppShell title="Google Calendar" subtitle={translateUi('Importe eventos como lancamentos')}>
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-tt-text-muted">{translateUi('Carregando...')}</p>
        </div>
      </AppShell>
    );
  }

  if (!connectionStatus?.connected) {
    return (
      <AppShell title="Google Calendar" subtitle={translateUi('Importe eventos como lancamentos')}>
        <div className="rounded-tt border border-tt-border bg-tt-surface p-8 shadow-sm">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-6 text-5xl">&#128197;</div>
            <h2 className="text-xl font-semibold text-tt-text">
              {translateUi('Conectar Google Calendar')}
            </h2>
            <p className="mt-3 text-sm text-tt-text-muted">
              {translateUi(
                'Conecte sua conta Google para importar eventos do calendario como lancamentos de horas. Somente leitura dos seus eventos sera utilizada.'
              )}
            </p>
            <ul className="mt-4 space-y-2 text-left text-sm text-tt-text-muted">
              <li>- Selecione quais eventos importar</li>
              <li>- Associe cada evento a um cliente</li>
              <li>- Ajuste a duração se necessário</li>
              <li>- Eventos já importados não serão duplicados</li>
            </ul>
            <button
              onClick={handleConnect}
              className="mt-6 rounded-2xl bg-tt-action px-6 py-3 text-sm font-semibold text-tt-on-action hover:bg-tt-action"
            >
              {translateUi('Conectar Google Calendar')}
            </button>
            {error && <p className="mt-4 text-sm text-tt-danger">{error}</p>}
          </div>
        </div>
      </AppShell>
    );
  }

  // --- Success state ---
  if (status === 'success') {
    return (
      <AppShell title="Google Calendar" subtitle={translateUi('Importacao concluida')}>
        <div className="rounded-tt border border-tt-border bg-tt-surface p-8 shadow-sm">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-4 text-5xl">&#9989;</div>
            <h2 className="text-xl font-semibold text-tt-action">
              {importedCount} {importedCount === 1 ? 'evento importado' : 'eventos importados'}
            </h2>
            <p className="mt-2 text-sm text-tt-text-muted">
              {translateUi('Os lancamentos foram criados com sucesso.')}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => {
                  setStatus('idle');
                  setRows([]);
                }}
                className="rounded-2xl border border-tt-border bg-tt-surface px-4 py-2 text-sm font-semibold text-tt-warning hover:bg-tt-warning-soft"
              >
                {translateUi('Importar mais')}
              </button>
              <a
                href="/time-entries"
                className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action hover:bg-tt-action"
              >
                {translateUi('Ver lancamentos')}
              </a>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // --- Connected state ---
  const calendarEmail =
    connectionStatus && connectionStatus.connected ? connectionStatus.calendarEmail : '';

  return (
    <AppShell title="Google Calendar" subtitle={translateUi('Importe eventos como lancamentos')}>
      <div className="space-y-6">
        {/* Connection info */}
        <div className="flex items-center justify-between rounded-tt border border-tt-border bg-tt-surface p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full bg-tt-success-soft0" />
            <span className="text-sm text-tt-text">
              {translateUi('Conectado como')}
              <span className="font-semibold">{calendarEmail}</span>
            </span>
          </div>
          <button
            onClick={handleDisconnect}
            className="rounded-2xl border border-tt-border px-3 py-1.5 text-xs font-semibold text-tt-warning hover:bg-tt-warning-soft"
          >
            {translateUi('Desconectar')}
          </button>
        </div>

        {/* Date range + fetch */}
        <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-tt-text-muted">
                {translateUi('Data inicio')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tt-text-muted">
                {translateUi('Data fim')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleFetchEvents}
              disabled={status === 'fetching'}
              className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action hover:bg-tt-action disabled:opacity-60"
            >
              {status === 'fetching' ? 'Buscando...' : 'Buscar eventos'}
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-tt-danger">{error}</p>}
        </div>

        {/* Events table */}
        {rows.length > 0 && (
          <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-tt-text">
                {rows.length} {rows.length === 1 ? 'evento encontrado' : 'eventos encontrados'}
              </h3>
              <label className="flex items-center gap-2 text-xs text-tt-text-muted">
                <input
                  type="checkbox"
                  checked={rows.filter((r) => !r.alreadyImported).every((r) => r.selected)}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="rounded"
                />
                {translateUi('Selecionar todos')}
              </label>
            </div>

            <div className="space-y-3">
              {rows.map((row, index) => (
                <div
                  key={row.googleEventId}
                  className={`grid gap-3 rounded-2xl border p-3 transition md:grid-cols-[auto_1fr_1fr_100px_1fr_auto] ${
                    row.alreadyImported
                      ? 'border-tt-border bg-tt-page opacity-60'
                      : row.selected
                        ? 'border-tt-success bg-tt-success-soft/30'
                        : 'border-tt-border bg-tt-surface'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      disabled={row.alreadyImported}
                      onChange={(e) => updateRow(index, { selected: e.target.checked })}
                      className="rounded"
                    />
                  </div>

                  {/* Activity description (editable) */}
                  <input
                    value={row.activityDescription}
                    onChange={(e) => updateRow(index, { activityDescription: e.target.value })}
                    disabled={row.alreadyImported}
                    className="rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm disabled:bg-tt-elevated"
                    title={`${row.date} ${formatTime(row.startDateTime)} - ${formatTime(row.endDateTime)}`}
                  />

                  {/* Client selector */}
                  <select
                    value={row.clientId}
                    onChange={(e) => updateRow(index, { clientId: Number(e.target.value) })}
                    disabled={row.alreadyImported || clients.length === 0}
                    className="rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm disabled:bg-tt-elevated"
                  >
                    <option value={0}>{translateUi('Cliente')}</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>

                  {/* Duration (editable) */}
                  <input
                    type="number"
                    value={row.editedDuration}
                    onChange={(e) =>
                      updateRow(index, {
                        editedDuration: Math.max(15, Math.min(720, Number(e.target.value))),
                      })
                    }
                    disabled={row.alreadyImported}
                    min={15}
                    max={720}
                    className="rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm disabled:bg-tt-elevated"
                    title={`Duração em minutos (${formatDuration(row.editedDuration)})`}
                  />

                  {/* Time info */}
                  <span className="flex items-center text-xs text-tt-text-muted">
                    {row.date} {formatTime(row.startDateTime)}-{formatTime(row.endDateTime)}
                  </span>

                  {/* Badge */}
                  <div className="flex items-center">
                    {row.alreadyImported && (
                      <span className="rounded-full bg-tt-elevated px-2 py-0.5 text-xs text-tt-text-muted">
                        {translateUi('Importado')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Import button */}
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleImport}
                disabled={
                  status === 'importing' ||
                  selectedRows.length === 0 ||
                  selectedRows.some((r) => r.clientId === 0)
                }
                className="rounded-2xl bg-tt-action px-6 py-2 text-sm font-semibold text-tt-on-action hover:bg-tt-action disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'importing'
                  ? 'Importando...'
                  : `Importar ${selectedRows.length} ${selectedRows.length === 1 ? 'evento' : 'eventos'}`}
              </button>
              {selectedRows.some((r) => r.clientId === 0) && (
                <span className="text-xs text-tt-warning">
                  {translateUi('Selecione um cliente para todos os eventos')}
                </span>
              )}
            </div>
          </div>
        )}

        {rows.length === 0 && status === 'idle' && !error && (
          <p className="text-center text-sm text-tt-text-muted">
            Selecione um periodo e clique em &quot;Buscar eventos&quot; para ver seus compromissos.
          </p>
        )}
      </div>
    </AppShell>
  );
};

export default CalendarImportPage;
