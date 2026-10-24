import { translate as translateUi, text, useLocale } from '../../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import { formatDate, parseDurationToMinutes } from '../../../utils/formatters';
import { fetchClientProjects } from '../time-entry/services/timeEntry.service';
import {
  clientRequiresProject,
  isBulkRowProjectValid,
  projectSelectOptionsForBulk,
  type BulkClientOption,
  type BulkProjectOption,
} from './bulkTimeEntryProject';

interface EntryRow {
  date: string;
  clientId: number;
  projectId: number | null;
  activityDescription: string;
  durationMinutes: string;
}

const formatDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createRow = (): EntryRow => ({
  date: formatDateInput(new Date()),
  clientId: 0,
  projectId: null,
  activityDescription: '',
  durationMinutes: '1h',
});

const BulkTimeEntryPage: React.FC = () => {
  const { user } = useAuth();
  const { capabilities } = useCapabilities();
  const locale = useLocale();
  const projectsEnabled = Boolean(capabilities?.flows?.projects);
  const [clients, setClients] = useState<BulkClientOption[]>([]);
  const [projectsByClient, setProjectsByClient] = useState<Record<number, BulkProjectOption[]>>(
    {}
  );
  const [rows, setRows] = useState<EntryRow[]>([createRow(), createRow()]);
  const [lockByClient, setLockByClient] = useState<
    Record<number, { lockDay: number | null; locked?: boolean; temporaryUnlock?: boolean }>
  >({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const today = new Date();

  const getMinDateForClient = (clientId: number) => {
    if (lockByClient[clientId]?.temporaryUnlock) return null;
    const lockDay = lockByClient[clientId]?.lockDay;
    if (!lockDay) return null;
    const todayDay = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    const minDate =
      todayDay > lockDay ? new Date(year, month, lockDay + 1) : new Date(year, month, 1);
    return formatDateInput(minDate);
  };
  const getMinDateLabel = (clientId: number) => {
    const minDate = getMinDateForClient(clientId);
    return minDate ? formatDate(minDate) : null;
  };

  useEffect(() => {
    const fetchClients = async () => {
      if (!user) return;
      try {
        const response = await api.get(`/api/users/${user.id}/clients`, {
          params: { includeHistorical: false },
        });
        setClients((response.data.data || []) as BulkClientOption[]);
      } catch (_err) {
        setClients([]);
      }
    };

    fetchClients();
  }, [user?.id]);

  useEffect(() => {
    const fetchLockStatus = async () => {
      if (clients.length === 0) {
        setLockByClient({});
        return;
      }
      try {
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        const results = await Promise.all(
          clients.map(async (client) => {
            const response = await api.get('/api/time-entries/lock-status', {
              params: { month, year, clientId: client.id },
            });
            return [client.id, response.data.data] as const;
          })
        );
        const next: Record<
          number,
          { lockDay: number | null; locked?: boolean; temporaryUnlock?: boolean }
        > = {};
        results.forEach(([clientId, data]) => {
          next[clientId] = {
            lockDay: data.lockDay ?? null,
            locked: data.locked,
            temporaryUnlock: data.temporaryUnlock,
          };
        });
        setLockByClient(next);
      } catch (_err) {
        setLockByClient({});
      }
    };

    fetchLockStatus();
  }, [clients.length]);

  useEffect(() => {
    if (clients.length === 0) return;
    setRows((prev) =>
      prev.map((row) => (row.clientId === 0 ? { ...row, clientId: clients[0].id } : row))
    );
  }, [clients]);

  useEffect(() => {
    setRows((prev) =>
      prev.map((row) => {
        const minDate = getMinDateForClient(row.clientId);
        if (minDate && row.date < minDate) {
          return { ...row, date: minDate };
        }
        return row;
      })
    );
  }, [lockByClient]);

  const clientIdsInRows = useMemo(
    () => Array.from(new Set(rows.map((row) => row.clientId).filter((id) => id > 0))),
    [rows]
  );

  useEffect(() => {
    if (!projectsEnabled) {
      setProjectsByClient({});
      return;
    }
    let cancelled = false;
    const load = async () => {
      const missing = clientIdsInRows.filter((id) => projectsByClient[id] === undefined);
      if (missing.length === 0) return;
      const fetched = await Promise.all(
        missing.map(async (clientId) => {
          try {
            const list = await fetchClientProjects(clientId);
            return [clientId, list] as const;
          } catch {
            return [clientId, [] as BulkProjectOption[]] as const;
          }
        })
      );
      if (cancelled) return;
      setProjectsByClient((prev) => {
        const next = { ...prev };
        for (const [clientId, list] of fetched) next[clientId] = list;
        return next;
      });
    };
    void load();
    return () => {
      cancelled = true;
    };
    // clientIdsInRows identity changes each render; join keeps fetch stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional key on ids
  }, [clientIdsInRows.join(','), projectsEnabled]);

  const updateRow = (index: number, patch: Partial<EntryRow>) => {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const next = { ...row, ...patch };
        if (patch.clientId !== undefined && patch.clientId !== row.clientId) {
          next.projectId = null;
        }
        return next;
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, createRow()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, idx) => idx !== index));

  const handleSubmit = async () => {
    setStatus('saving');
    setError(null);

    try {
      const entries = rows.map((row) => ({
        date: row.date,
        clientId: row.clientId,
        activityDescription: row.activityDescription,
        durationMinutes: row.durationMinutes,
        ...(projectsEnabled ? { projectId: row.projectId } : {}),
      }));
      await api.post('/api/time-entries/bulk', { entries });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    }
  };

  const isValid = rows.every((row) => {
    const requireProject = clientRequiresProject(clients, row.clientId, projectsEnabled);
    return (
      row.clientId > 0 &&
      row.activityDescription.trim().length > 2 &&
      parseDurationToMinutes(row.durationMinutes) !== null &&
      isBulkRowProjectValid({
        projectsEnabled,
        requireProject,
        projectId: row.projectId,
      })
    );
  });

  return (
    <AppShell
      title={translateUi('Lote de lancamentos')}
      subtitle={translateUi('Cadastre varios lancamentos de uma vez')}
    >
      <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="space-y-4" role="list" aria-label={text('Linhas do lote', 'Batch rows')}>
          {rows.map((row, index) => {
            const requireProject = clientRequiresProject(clients, row.clientId, projectsEnabled);
            const projectOptions = projectSelectOptionsForBulk({
              projects: projectsByClient[row.clientId] ?? [],
              requireProject,
              locale: locale === 'en' ? 'en' : 'pt',
            });
            const dateId = `bulk-date-${index}`;
            const clientIdAttr = `bulk-client-${index}`;
            const projectIdAttr = `bulk-project-${index}`;
            const activityId = `bulk-activity-${index}`;
            const durationId = `bulk-duration-${index}`;
            return (
              <div
                key={index}
                role="listitem"
                className={`grid gap-3 ${
                  projectsEnabled
                    ? 'md:grid-cols-[1fr_1.1fr_1.1fr_1.6fr_0.9fr_auto]'
                    : 'md:grid-cols-[1fr_1.2fr_2fr_1fr_auto]'
                }`}
              >
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tt-text" htmlFor={dateId}>
                    {text('Data', 'Date')}
                  </label>
                  <input
                    id={dateId}
                    type="date"
                    value={row.date}
                    onChange={(event) => updateRow(index, { date: event.target.value })}
                    min={getMinDateForClient(row.clientId) ?? undefined}
                    className="min-h-touch w-full rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm"
                  />
                  {getMinDateLabel(row.clientId) ? (
                    <span className="mt-1 block text-xs text-tt-text-muted">
                      Fechamento aplicado. A partir de {getMinDateLabel(row.clientId)}.
                    </span>
                  ) : null}
                  {lockByClient[row.clientId]?.locked &&
                  lockByClient[row.clientId]?.temporaryUnlock ? (
                    <span className="mt-1 block text-xs font-semibold text-tt-success">
                      {translateUi('Desbloqueio temporario ativo para correcao.')}
                    </span>
                  ) : null}
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-semibold text-tt-text"
                    htmlFor={clientIdAttr}
                  >
                    {text('Cliente', 'Client')}
                  </label>
                  <select
                    id={clientIdAttr}
                    value={row.clientId}
                    onChange={(event) =>
                      updateRow(index, { clientId: Number(event.target.value) })
                    }
                    className="min-h-touch w-full rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm"
                    disabled={clients.length === 0}
                  >
                    <option value={0}>
                      {clients.length === 0 ? 'Sem clientes' : translateUi('Cliente')}
                    </option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
                {projectsEnabled ? (
                  <div>
                    <label
                      className="mb-1 block text-xs font-semibold text-tt-text"
                      htmlFor={projectIdAttr}
                    >
                      {text('Projeto', 'Project')}
                      {requireProject ? (
                        <span className="text-tt-danger" aria-hidden="true">
                          {' '}
                          *
                        </span>
                      ) : null}
                    </label>
                    <select
                      id={projectIdAttr}
                      value={row.projectId ?? 0}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        updateRow(index, { projectId: value > 0 ? value : null });
                      }}
                      className="min-h-touch w-full rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm"
                      required={requireProject}
                      aria-required={requireProject}
                    >
                      {requireProject ? (
                        <option value={0}>
                          {text('Selecione um projeto', 'Select a project')}
                        </option>
                      ) : null}
                      {projectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {requireProject ? (
                      <span className="mt-1 block text-xs text-tt-text-muted">
                        {text(
                          'Este cliente exige projeto nos lançamentos.',
                          'This client requires a project on entries.'
                        )}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <label
                    className="mb-1 block text-xs font-semibold text-tt-text"
                    htmlFor={activityId}
                  >
                    {text('Atividade', 'Activity')}
                  </label>
                  <input
                    id={activityId}
                    value={row.activityDescription}
                    onChange={(event) =>
                      updateRow(index, { activityDescription: event.target.value })
                    }
                    placeholder={translateUi('Atividade')}
                    className="min-h-touch w-full rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-semibold text-tt-text"
                    htmlFor={durationId}
                  >
                    {text('Duração', 'Duration')}
                  </label>
                  <input
                    id={durationId}
                    type="text"
                    value={row.durationMinutes}
                    onChange={(event) => updateRow(index, { durationMinutes: event.target.value })}
                    className="min-h-touch w-full rounded-tt border border-tt-border bg-tt-surface px-3 py-2 text-sm"
                    placeholder="Ex: 1h 30m"
                    title="Exemplos: 1h, 1h 30m, 90m, 2 hr, 45 minutes"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="tt-btn-secondary min-h-touch px-3 text-sm text-tt-warning"
                    aria-label={text(`Remover linha ${index + 1}`, `Remove row ${index + 1}`)}
                  >
                    {translateUi('Remover')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addRow}
            className="tt-btn-secondary min-h-touch px-4 text-sm font-semibold"
          >
            {translateUi('+ Adicionar linha')}
          </button>
          <button
            type="button"
            disabled={status === 'saving' || !isValid}
            onClick={handleSubmit}
            className="tt-btn-primary min-h-touch px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'saving' ? translateUi('Salvando...') : 'Salvar tudo'}
          </button>
        </div>

        {status === 'success' ? (
          <p className="mt-4 text-sm font-semibold text-tt-success" role="status">
            {translateUi('Lancamentos cadastrados.')}
          </p>
        ) : null}
        {status === 'error' ? (
          <p className="mt-4 text-sm text-tt-danger" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mt-4 text-xs text-tt-text-muted">
          Dicas de duracao: 90m, 1h, 1h 30m, 2 hr, 45 minutes.
        </p>
      </div>
    </AppShell>
  );
};

export default BulkTimeEntryPage;
