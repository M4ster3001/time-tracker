import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useCapabilities } from '../../../../contexts/CapabilitiesContext';
import { text } from '../../../../i18n';
import {
  extractApiError,
  extractApiValidationErrors,
  formatDate,
  formatMinutes,
  parseDurationToMinutes,
} from '../../../../utils/formatters';
import {
  canPrivilegedCorrectLockedEntry as canPrivilegedCorrectLockedEntryFn,
  isLockBlockingEdit,
} from '../../../../utils/timeEntryLockUi';
import {
  TIME_ENTRY_DEFAULT_DURATION_INPUT,
  TIME_ENTRY_MIN_DURATION_MINUTES,
} from '../constants/timeEntry.constants';
import {
  confirmTimeEntryDuration,
  createTimeEntry,
  fetchClientProjects,
  fetchTimeEntry,
  fetchTimeEntryAiStatus,
  fetchTimeEntryClients,
  fetchTimeEntryLockStatus,
  updateTimeEntry,
} from '../services/timeEntry.service';
import type { EstimateRevisionRow } from '../services/estimates.service';
import type {
  ClientOption,
  ProjectOption,
  TimeEntryAiStatus,
  TimeEntryDurationContract,
  TimeEntryLockStatus,
} from '../types/timeEntry.types';

const formatDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useTimeEntryPage = () => {
  const { user } = useAuth();
  const { capabilities, can } = useCapabilities();
  const projectsEnabled = Boolean(capabilities?.flows?.projects);
  const estimatesEnabled = Boolean(capabilities?.flows?.estimates);
  const trackingEnabled = Boolean(capabilities?.flows?.tracking);
  const canConfirmDuration = estimatesEnabled && can('estimates.confirm');
  const canProposeEstimate = estimatesEnabled && can('estimates.propose');
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(id);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [clientId, setClientId] = useState<number>(0);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [workActivityId, setWorkActivityId] = useState<number | null>(null);
  const [confirmationSnapshot, setConfirmationSnapshot] = useState<{
    confirmedMinutes: number | null;
    confirmedAt: string | null;
    confirmedByUserId: number | null;
  } | null>(null);
  const [lastEstimateRevision, setLastEstimateRevision] = useState<EstimateRevisionRow | null>(
    null
  );
  const [date, setDate] = useState(formatDateInput(new Date()));
  const [activityDescription, setActivityDescription] = useState('');
  const [durationInput, setDurationInput] = useState(TIME_ENTRY_DEFAULT_DURATION_INPUT);
  const [confirmJustification, setConfirmJustification] = useState('');
  const [durations, setDurations] = useState<TimeEntryDurationContract | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lockStatus, setLockStatus] = useState<TimeEntryLockStatus | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [entryOwnerId, setEntryOwnerId] = useState<number | null>(null);
  const [aiStatus, setAiStatus] = useState<TimeEntryAiStatus | null>(null);
  const today = useMemo(() => new Date(), []);
  const todayInputDate = useMemo(() => formatDateInput(today), [today]);
  const canPrivilegedCorrectLockedEntry = useMemo(
    () => canPrivilegedCorrectLockedEntryFn(isEditing, user, entryOwnerId),
    [isEditing, user, entryOwnerId]
  );

  const minSelectableDate = useMemo(() => {
    if (canPrivilegedCorrectLockedEntry) return null;
    if (lockStatus?.temporaryUnlock) return null;
    const lockDay = lockStatus?.lockDay ?? null;
    if (!lockDay) return null;
    const todayDay = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    const minDate =
      todayDay > lockDay ? new Date(year, month, lockDay + 1) : new Date(year, month, 1);
    return formatDateInput(minDate);
  }, [canPrivilegedCorrectLockedEntry, lockStatus?.lockDay, lockStatus?.temporaryUnlock, today]);

  const entryMonthYear = useMemo(() => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return { month: parsed.getMonth() + 1, year: parsed.getFullYear() };
  }, [date]);

  const parsedDurationMinutes = useMemo(
    () => parseDurationToMinutes(durationInput),
    [durationInput]
  );
  const lockBlocked = isLockBlockingEdit(lockStatus, canPrivilegedCorrectLockedEntry);

  useEffect(() => {
    const loadClients = async () => {
      if (!user) return;
      try {
        const nextClients = await fetchTimeEntryClients(user.id, false);
        setClients(nextClients);
      } catch {
        setClients([]);
      }
    };
    void loadClients();
  }, [user?.id]);

  useEffect(() => {
    void fetchTimeEntryAiStatus()
      .then(setAiStatus)
      .catch(() => setAiStatus({ enabled: false }));
  }, []);

  useEffect(() => {
    if (clients.length > 0 && clientId === 0) {
      setClientId(clients[0].id);
    }
  }, [clients, clientId]);

  useEffect(() => {
    if (isEditing || clients.length === 0) return;
    const clientIdParam = Number(searchParams.get('clientId'));
    if (!Number.isInteger(clientIdParam) || clientIdParam <= 0) return;
    if (!clients.some((client) => client.id === clientIdParam)) return;
    setClientId(clientIdParam);
  }, [clients, isEditing, searchParams]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!projectsEnabled || !clientId) {
        setProjects([]);
        return;
      }
      try {
        const next = await fetchClientProjects(clientId);
        setProjects(next.filter((p) => p.state === 'ACTIVE' || p.state === 'PLANNED'));
      } catch {
        setProjects([]);
      }
    };
    void loadProjects();
  }, [clientId, projectsEnabled]);

  useEffect(() => {
    const loadEntry = async () => {
      if (!isEditing || !id) return;
      setLoadingEntry(true);
      try {
        const entry = await fetchTimeEntry(id);
        setEntryOwnerId(Number(entry.userId));
        setClientId(entry.clientId);
        setProjectId(entry.projectId ?? null);
        setWorkActivityId(entry.workActivityId ?? null);
        setConfirmationSnapshot({
          confirmedMinutes:
            entry.confirmedDurationMinutes ?? entry.durations?.confirmedMinutes ?? null,
          confirmedAt: entry.confirmedAt ?? null,
          confirmedByUserId: entry.confirmedByUserId ?? null,
        });
        setLastEstimateRevision(null);
        setDate(entry.date.slice(0, 10));
        setActivityDescription(entry.activityDescription);
        setDurationInput(formatMinutes(entry.durationMinutes));
        setDurations(entry.durations ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar lançamento');
      } finally {
        setLoadingEntry(false);
      }
    };
    void loadEntry();
  }, [id, isEditing]);

  useEffect(() => {
    const loadHistoricalEntryClient = async () => {
      if (!user || !isEditing || clientId === 0) return;
      if (clients.some((client) => client.id === clientId)) return;

      try {
        const historicalClients = await fetchTimeEntryClients(user.id, true);
        const currentEntryClient = historicalClients.find((client) => client.id === clientId);
        if (!currentEntryClient) return;
        setClients((prev) => {
          if (prev.some((client) => client.id === currentEntryClient.id)) return prev;
          return [...prev, currentEntryClient].sort((a, b) =>
            a.name.localeCompare(b.name, 'pt-BR')
          );
        });
      } catch {
        // Keep current list when the historical client cannot be resolved.
      }
    };

    void loadHistoricalEntryClient();
  }, [user?.id, isEditing, clientId, clients]);

  useEffect(() => {
    const loadLockStatus = async () => {
      if (!entryMonthYear) return;
      try {
        const nextLockStatus = await fetchTimeEntryLockStatus(
          entryMonthYear.month,
          entryMonthYear.year,
          clientId || undefined
        );
        setLockStatus(nextLockStatus);
      } catch {
        setLockStatus(null);
      }
    };
    void loadLockStatus();
  }, [entryMonthYear?.month, entryMonthYear?.year, clientId]);

  useEffect(() => {
    if (!minSelectableDate) return;
    if (date < minSelectableDate) setDate(minSelectableDate);
  }, [minSelectableDate, date]);

  const submit = async () => {
    setStatus('saving');
    setError(null);
    setFieldErrors({});

    if (date > todayInputDate) {
      setStatus('error');
      setError('Não é permitido lançar horas em datas futuras.');
      setFieldErrors({ date: 'A data não pode ser futura.' });
      return;
    }

    if (parsedDurationMinutes === null) {
      setStatus('error');
      setFieldErrors({ durationMinutes: 'Formato inválido. Use valores como 30m, 1h, 1h 30m.' });
      return;
    }

    if (parsedDurationMinutes < TIME_ENTRY_MIN_DURATION_MINUTES) {
      setStatus('error');
      setFieldErrors({ durationMinutes: 'A duração mínima é de 15 minutos.' });
      return;
    }

    const selectedClient = clients.find((client) => client.id === clientId);
    if (
      projectsEnabled &&
      selectedClient?.requireProjectOnEntries &&
      (projectId == null || projectId <= 0)
    ) {
      setStatus('error');
      setFieldErrors({
        projectId: text('Selecione um projeto.', 'Select a project.'),
      });
      setError(text('Este cliente exige projeto.', 'This client requires a project.'));
      return;
    }

    try {
      const payload = {
        clientId,
        date,
        activityDescription,
        durationMinutes: parsedDurationMinutes,
        ...(projectsEnabled ? { projectId } : {}),
      };
      if (isEditing && id) {
        await updateTimeEntry(id, payload);
      } else {
        await createTimeEntry(payload);
      }
      setStatus('success');
      if (!isEditing) setActivityDescription('');
    } catch (err) {
      setStatus('error');
      setFieldErrors(extractApiValidationErrors(err));
      setError(extractApiError(err, 'Falha ao salvar lançamento'));
    }
  };

  const confirmDuration = async () => {
    if (!isEditing || !id || parsedDurationMinutes === null || !canConfirmDuration) return;
    setStatus('saving');
    setError(null);
    try {
      const justification = confirmJustification.trim();
      const updated = await confirmTimeEntryDuration(id, {
        confirmedMinutes: parsedDurationMinutes,
        ...(justification ? { justification } : {}),
      });
      setDurations(updated.durations ?? null);
      setDurationInput(formatMinutes(updated.durationMinutes));
      setConfirmationSnapshot({
        confirmedMinutes: updated.durations?.confirmedMinutes ?? parsedDurationMinutes,
        confirmedAt: new Date().toISOString(),
        confirmedByUserId: user?.id ?? null,
      });
      setConfirmJustification('');
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(extractApiError(err, 'Falha ao confirmar duração'));
    }
  };

  const reloadEntryDurations = async () => {
    if (!isEditing || !id) return;
    try {
      const entry = await fetchTimeEntry(id);
      setDurations(entry.durations ?? null);
    } catch {
      // Keep current durations when refresh fails after stop.
    }
  };

  return {
    isEditing,
    id,
    numericEntryId: id ? Number(id) : null,
    clients,
    projects,
    projectsEnabled,
    estimatesEnabled,
    trackingEnabled,
    canConfirmDuration,
    canProposeEstimate,
    workActivityId,
    setWorkActivityId,
    confirmationSnapshot,
    lastEstimateRevision,
    setLastEstimateRevision,
    confirmDuration,
    reloadEntryDurations,
    clientId,
    setClientId: (next: number) => {
      setClientId(next);
      setProjectId(null);
    },
    projectId,
    setProjectId,
    date,
    setDate,
    activityDescription,
    setActivityDescription,
    durationInput,
    setDurationInput,
    confirmJustification,
    setConfirmJustification,
    durations,
    parsedDurationMinutes,
    status,
    error,
    fieldErrors,
    lockStatus,
    loadingEntry,
    aiStatus,
    todayInputDate,
    canPrivilegedCorrectLockedEntry,
    minSelectableDate,
    lockBlocked,
    submit,
    goBack: () => navigate('/time-entries'),
    lockHint: lockStatus?.lockDay
      ? `Fechamento no dia ${lockStatus.lockDay}.${minSelectableDate ? ` Datas a partir de ${formatDate(minSelectableDate)}.` : 'Datas anteriores ao período permitido não podem ser selecionadas.'}`
      : undefined,
  };
};
