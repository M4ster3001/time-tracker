import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { isAbortError } from '../../../../utils/abort';
import { extractApiError, parseDurationToMinutes } from '../../../../utils/formatters';
import {
  TIME_ENTRY_CORRECTIONS_DEFAULT_PAGE_SIZE,
  TIME_ENTRY_CORRECTIONS_LOOKBACK_DAYS,
} from '../constants';
import {
  deleteTimeEntryCorrection,
  fetchTimeEntryCorrectionsEditClients,
  fetchTimeEntryCorrectionsEntries,
  fetchTimeEntryCorrectionsFilters,
  updateTimeEntryCorrection,
} from '../services';
import type {
  TimeEntryCorrectionsClientOption,
  TimeEntryCorrectionsDeleteConfirmState,
  TimeEntryCorrectionsEditDraft,
  TimeEntryCorrectionsSupervisedEntry,
  TimeEntryCorrectionsUserOption,
} from '../types';

const toDateInput = (value: Date): string => value.toISOString().slice(0, 10);

export const useTimeEntryCorrectionsPage = () => {
  const { user } = useAuth();
  const [userId, setUserId] = useState(0);
  const [clientId, setClientId] = useState(0);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - TIME_ENTRY_CORRECTIONS_LOOKBACK_DAYS);
    return toDateInput(date);
  });
  const [endDate, setEndDate] = useState(() => toDateInput(new Date()));
  const [users, setUsers] = useState<TimeEntryCorrectionsUserOption[]>([]);
  const [clients, setClients] = useState<TimeEntryCorrectionsClientOption[]>([]);
  const [entries, setEntries] = useState<TimeEntryCorrectionsSupervisedEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(TIME_ENTRY_CORRECTIONS_DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TimeEntryCorrectionsDeleteConfirmState>({
    isOpen: false,
    entryId: null,
    title: '',
  });
  const [editing, setEditing] = useState<TimeEntryCorrectionsEditDraft | null>(null);
  const [editClients, setEditClients] = useState<TimeEntryCorrectionsClientOption[]>([]);
  const [saving, setSaving] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const refreshEntries = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTimeEntryCorrectionsEntries({
        userId: userId || undefined,
        clientId: clientId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: pageSize,
        signal,
      });
      if (signal?.aborted) return;
      setEntries(response.items || []);
      setTotal(response.total || 0);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(extractApiError(err, 'Não foi possível carregar os lançamentos supervisionados.'));
      setEntries([]);
      setTotal(0);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [clientId, endDate, page, pageSize, startDate, userId]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const loadFilters = async () => {
      try {
        const data = await fetchTimeEntryCorrectionsFilters(user.roleId, controller.signal);
        setUsers(data.users);
        setClients(data.clients);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(extractApiError(err, 'Não foi possível carregar filtros.'));
      }
    };

    void loadFilters();
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    void refreshEntries(controller.signal);
    return () => controller.abort();
  }, [refreshEntries]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleUserChange = useCallback((value: number) => {
    setUserId(value);
    setPage(1);
  }, []);

  const handleClientChange = useCallback((value: number) => {
    setClientId(value);
    setPage(1);
  }, []);

  const handleStartDateChange = useCallback((value: string) => {
    setStartDate(value);
    setPage(1);
  }, []);

  const handleEndDateChange = useCallback((value: string) => {
    setEndDate(value);
    setPage(1);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm.entryId) return;
    setSaving(true);
    try {
      await deleteTimeEntryCorrection(deleteConfirm.entryId);
      setDeleteConfirm({ isOpen: false, entryId: null, title: '' });
      await refreshEntries();
    } catch (err) {
      setError(extractApiError(err, 'Não foi possível excluir o lançamento.'));
    } finally {
      setSaving(false);
    }
  }, [deleteConfirm.entryId, refreshEntries]);

  const openEdit = useCallback(async (entry: TimeEntryCorrectionsSupervisedEntry) => {
    setEditing({
      id: entry.id,
      userId: entry.userId,
      clientId: entry.clientId,
      date: entry.date.slice(0, 10),
      activityDescription: entry.activityDescription,
      durationMinutes: String(entry.durationMinutes),
    });

    try {
      const date = new Date(entry.date);
      const editOptions = await fetchTimeEntryCorrectionsEditClients(
        entry.userId,
        date.getUTCFullYear(),
        date.getUTCMonth() + 1
      );
      setEditClients(editOptions);
    } catch (_err) {
      setEditClients([]);
    }
  }, []);

  const closeEdit = useCallback(() => {
    setEditing(null);
    setEditClients([]);
  }, []);

  const updateEditing = useCallback(
    (updater: (current: TimeEntryCorrectionsEditDraft) => TimeEntryCorrectionsEditDraft) => {
      setEditing((current) => (current ? updater(current) : current));
    },
    []
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;
    const parsedDuration = parseDurationToMinutes(editing.durationMinutes);
    if (parsedDuration === null) {
      setError('Duração invalida. Use formatos como 90m, 1h, 1h 30m ou minutos inteiros.');
      return;
    }

    setSaving(true);
    try {
      await updateTimeEntryCorrection(editing.id, {
        clientId: editing.clientId,
        date: editing.date,
        activityDescription: editing.activityDescription,
        durationMinutes: parsedDuration,
      });
      closeEdit();
      await refreshEntries();
    } catch (err) {
      setError(extractApiError(err, 'Não foi possível atualizar o lançamento.'));
    } finally {
      setSaving(false);
    }
  }, [closeEdit, editing, refreshEntries]);

  const openDelete = useCallback((entry: TimeEntryCorrectionsSupervisedEntry) => {
    setDeleteConfirm({
      isOpen: true,
      entryId: entry.id,
      title: entry.activityDescription,
    });
  }, []);

  const closeDelete = useCallback(() => {
    setDeleteConfirm({ isOpen: false, entryId: null, title: '' });
  }, []);

  return {
    state: {
      userId,
      clientId,
      startDate,
      endDate,
      users,
      clients,
      entries,
      total,
      page,
      pageSize,
      loading,
      error,
      deleteConfirm,
      editing,
      editClients,
      saving,
      totalPages,
    },
    actions: {
      refreshEntries,
      handleUserChange,
      handleClientChange,
      handleStartDateChange,
      handleEndDateChange,
      setPage,
      setPageSize,
      openEdit,
      closeEdit,
      updateEditing,
      handleSaveEdit,
      openDelete,
      closeDelete,
      handleDelete,
      setError,
    },
  };
};
