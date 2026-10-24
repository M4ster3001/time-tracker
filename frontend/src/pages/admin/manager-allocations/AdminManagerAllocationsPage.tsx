import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import api from '../../../services/api';
import { monthOptions } from '../../../utils/formatters';
import AllocationTable from '../../shared/allocations/AllocationTable';
import PersonDetailsEditor, { type PersonForm } from '../../shared/allocations/PersonDetailsEditor';
import { useAllocationEditor } from '../../shared/allocations/useAllocationEditor';
import {
  buildWorkingDays,
  formatEffectiveDate,
  getNextMonthEffectiveDate,
} from '../../shared/allocations/allocationDate.calculators';
import type { ClientLinkRow, ScopeOption } from '../../shared/allocations/allocation.types';

const AdminManagerAllocationsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [managers, setManagers] = useState<ScopeOption[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<number>(0);
  const [managerForm, setManagerForm] = useState<PersonForm>({
    name: '',
    email: '',
    isActive: true,
  });
  const [managerDetailsActive, setManagerDetailsActive] = useState<boolean | undefined>(undefined);
  const [savingManager, setSavingManager] = useState(false);
  const [clients, setClients] = useState<ClientLinkRow[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const initialSelectionApplied = useRef(false);

  const years = useMemo(() => [year - 1, year, year + 1], [year]);
  const workingDays = useMemo(() => buildWorkingDays(year, month), [year, month]);
  const defaultEffectiveFromLabel = useMemo(
    () => formatEffectiveDate(getNextMonthEffectiveDate()),
    []
  );

  const editor = useAllocationEditor({
    scopeId: selectedManagerId,
    endpoints: {
      list: `/api/users/${selectedManagerId}/allocations`,
      item: (clientId) => `/api/users/${selectedManagerId}/allocations/${clientId}`,
    },
  });

  useEffect(() => {
    api
      .get('/api/users', { params: { roleId: 2, includeInactive: true } })
      .then((response) => setManagers(response.data.data || []))
      .catch(() => setManagers([]));
    api
      .get('/api/clients', { params: { includeInactive: true } })
      .then((response) => setClients(response.data.data || []))
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    if (managers.length === 0) return;
    if (!initialSelectionApplied.current) {
      const initialId = Number(searchParams.get('managerId') || 0);
      if (initialId && managers.some((manager) => manager.id === initialId)) {
        setSelectedManagerId(initialId);
      } else if (selectedManagerId === 0) {
        setSelectedManagerId(managers[0]?.id ?? 0);
      }
      initialSelectionApplied.current = true;
      return;
    }
    if (selectedManagerId === 0) {
      setSelectedManagerId(managers[0]?.id ?? 0);
    }
  }, [managers, selectedManagerId, searchParams]);

  useEffect(() => {
    if (!selectedManagerId) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('managerId', String(selectedManagerId));
        return next;
      },
      { replace: true }
    );

    api
      .get(`/api/users/${selectedManagerId}`)
      .then((response) => {
        const data = response.data.data;
        setManagerDetailsActive(data.isActive ?? true);
        setManagerForm({
          name: data.name ?? '',
          email: data.email ?? '',
          isActive: data.isActive ?? true,
        });
      })
      .catch(() => setManagerDetailsActive(undefined));

    api
      .get(`/api/users/${selectedManagerId}/clients`, { params: { includeHistorical: false } })
      .then((response) =>
        setSelectedClientIds((response.data.data || []).map((c: ClientLinkRow) => c.id))
      )
      .catch(() => setSelectedClientIds([]));
  }, [selectedManagerId, setSearchParams]);

  const handleSaveManager = async () => {
    if (!selectedManagerId) return;
    const changedStatus =
      managerDetailsActive !== undefined && managerDetailsActive !== managerForm.isActive;
    if (changedStatus) {
      const confirmed = window.confirm(
        `Tem certeza que deseja ${managerForm.isActive ? 'ativar' : 'desativar'} este manager?`
      );
      if (!confirmed) return;
    }
    setSavingManager(true);
    try {
      await api.put(`/api/users/${selectedManagerId}`, {
        name: managerForm.name,
        email: managerForm.email,
        isActive: managerForm.isActive,
      });
      setManagerDetailsActive(managerForm.isActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar manager');
    } finally {
      setSavingManager(false);
    }
  };

  const toggleClient = async (clientIdToToggle: number) => {
    const targetClient = clients.find((c) => c.id === clientIdToToggle);
    if (targetClient && !targetClient.isActive) {
      setError('Cliente inativo não pode ser vinculado');
      return;
    }
    const isLinked = selectedClientIds.includes(clientIdToToggle);
    setSelectedClientIds((prev) =>
      isLinked ? prev.filter((id) => id !== clientIdToToggle) : [...prev, clientIdToToggle]
    );
    try {
      if (isLinked) {
        await api.delete(`/api/users/${selectedManagerId}/clients/${clientIdToToggle}`);
      } else {
        await api.post(`/api/users/${selectedManagerId}/clients/${clientIdToToggle}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar clientes');
    }
  };

  return (
    <AppShell
      title={translateUi('Managers (Admin)')}
      subtitle={translateUi('Defina horas alocadas por cliente')}
    >
      {editor.loading ? (
        <div className="rounded-tt border border-tt-border bg-tt-surface p-10 text-center text-tt-text-muted">
          {translateUi('Carregando alocacoes...')}
        </div>
      ) : editor.error || error ? (
        <div className="rounded-3xl border border-tt-danger bg-tt-danger-soft p-6 text-sm text-tt-danger">
          {editor.error || error}
        </div>
      ) : (
        <AllocationTable
          scopeLabel="manager"
          year={year}
          years={years}
          onYearChange={setYear}
          month={month}
          monthOptions={monthOptions}
          onMonthChange={setMonth}
          scopeOptions={managers}
          scopeId={selectedManagerId}
          onScopeChange={setSelectedManagerId}
          notice={editor.notice}
          effectiveFromLabel={defaultEffectiveFromLabel}
          rows={editor.paginatedAllocations}
          drafts={editor.drafts}
          workingDays={workingDays}
          saving={editor.saving}
          savingAll={editor.savingAll}
          onDraftChange={editor.handleDraftChange}
          onSave={editor.handleSave}
          onClear={editor.handleClear}
          onSaveAll={editor.handleSaveAll}
          totalCount={editor.allocations.length}
          page={editor.page}
          pageSize={editor.pageSize}
          onPageChange={editor.setPage}
          onPageSizeChange={editor.setPageSize}
        >
          <PersonDetailsEditor
            personLabel="manager"
            form={managerForm}
            onFormChange={(updater) => setManagerForm(updater)}
            onSave={handleSaveManager}
            saving={savingManager}
            clients={clients}
            selectedClientIds={selectedClientIds}
            onToggleClient={toggleClient}
          />
        </AllocationTable>
      )}
    </AppShell>
  );
};

export default AdminManagerAllocationsPage;
