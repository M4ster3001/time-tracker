import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import { useNotice } from '../../../hooks/useNotice';
import { usePagination } from '../../../hooks/usePagination';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import type { AllocationDraft, AllocationRow } from './allocation.types';
import {
  buildDraftPayload,
  draftsFromRows,
  emptyDraft,
  type AllocationPayload,
} from './useAllocationEditor.logic';

export interface AllocationEditorEndpoints {
  /** GET da lista de alocacoes do escopo atual (manager/consultor). */
  list: string;
  /** PUT/DELETE de uma linha, dado o clientId. */
  item: (clientId: number) => string;
}

export interface UseAllocationEditorConfig {
  scopeId: number;
  endpoints: AllocationEditorEndpoints;
}

/**
 * Extrai o CRUD de alocacoes (buscar/editar/salvar/limpar/salvar-tudo) duplicado
 * nas 3 paginas de alocacao. `endpoints` isola a diferenca de rota entre elas
 * (admin vs manager, managers vs consultores).
 */
export const useAllocationEditor = ({ scopeId, endpoints }: UseAllocationEditorConfig) => {
  const { can } = useCapabilities();
  const requiredScope = endpoints.list.startsWith('/api/manager/') ? 'team' : 'all';
  const canWriteRates = can('rates.write', requiredScope);
  const requestPayload = (payload: AllocationPayload) => {
    const { hourlyRate: _hourlyRate, ...hours } = payload;
    return canWriteRates ? payload : hours;
  };
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, AllocationDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notice, showNotice } = useNotice();
  const { page, pageSize, setPage, setPageSize, paginatedItems } = usePagination(allocations);

  const fetchAllocations = useCallback(async () => {
    if (!scopeId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(endpoints.list);
      const rows: AllocationRow[] = response.data.data || [];
      setAllocations(rows);
      setDrafts(draftsFromRows(rows));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar alocações');
      setAllocations([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, endpoints.list]);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  const handleDraftChange = (clientId: number, field: keyof AllocationDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [clientId]: { ...emptyDraft(), ...prev[clientId], [field]: value },
    }));
  };

  const applyPayload = (clientId: number, payload: AllocationPayload) => {
    setAllocations((prev) =>
      prev.map((item) =>
        item.clientId === clientId ? { ...item, allocation: { ...payload } } : item
      )
    );
  };

  const handleSave = async (row: AllocationRow) => {
    if (!drafts[row.clientId] || !scopeId) return;
    const payload = buildDraftPayload(drafts[row.clientId]);
    if (!payload) {
      showNotice('error', 'Informe horas válidas para salvar.');
      return;
    }
    setSaving((prev) => ({ ...prev, [row.clientId]: true }));
    try {
      await api.put(endpoints.item(row.clientId), requestPayload(payload));
      applyPayload(row.clientId, payload);
      showNotice('success', 'Alocação salva com sucesso.');
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'Falha ao salvar alocação.');
    } finally {
      setSaving((prev) => ({ ...prev, [row.clientId]: false }));
    }
  };

  const handleClear = async (row: AllocationRow) => {
    if (!scopeId) return;
    setSaving((prev) => ({ ...prev, [row.clientId]: true }));
    try {
      await api.delete(endpoints.item(row.clientId));
      setAllocations((prev) =>
        prev.map((item) => (item.clientId === row.clientId ? { ...item, allocation: null } : item))
      );
      setDrafts((prev) => ({ ...prev, [row.clientId]: emptyDraft() }));
      showNotice('success', 'Alocação removida.');
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'Falha ao remover alocação.');
    } finally {
      setSaving((prev) => ({ ...prev, [row.clientId]: false }));
    }
  };

  const handleSaveAll = async () => {
    if (!scopeId || allocations.length === 0) return;
    const pending = allocations
      .map((row) => ({ row, payload: buildDraftPayload(drafts[row.clientId]) }))
      .filter((entry): entry is { row: AllocationRow; payload: AllocationPayload } =>
        Boolean(entry.payload)
      );

    if (pending.length === 0) {
      showNotice('error', 'Nenhuma alteracao valida para salvar.');
      return;
    }

    setSavingAll(true);
    try {
      await Promise.all(
        pending.map(({ row, payload }) =>
          api.put(endpoints.item(row.clientId), requestPayload(payload))
        )
      );
      pending.forEach(({ row, payload }) => applyPayload(row.clientId, payload));
      showNotice('success', 'Todas as alterações válidas foram salvas.');
    } catch (_err) {
      showNotice('error', 'Falha ao salvar todas as alocações.');
    } finally {
      setSavingAll(false);
    }
  };

  return {
    allocations,
    drafts,
    loading,
    error,
    notice,
    saving,
    savingAll,
    page,
    pageSize,
    setPage,
    setPageSize,
    paginatedAllocations: paginatedItems,
    handleDraftChange,
    handleSave,
    handleClear,
    handleSaveAll,
  };
};
