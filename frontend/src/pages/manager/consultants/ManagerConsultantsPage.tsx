import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
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

const ManagerConsultantsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [consultants, setConsultants] = useState<ScopeOption[]>([]);
  const [selectedConsultantId, setSelectedConsultantId] = useState<number>(0);
  const [managers, setManagers] = useState<ScopeOption[]>([]);
  const [consultantForm, setConsultantForm] = useState<PersonForm>({
    name: '',
    email: '',
    isActive: true,
  });
  const [consultantManagerId, setConsultantManagerId] = useState(0);
  const [consultantDetailsActive, setConsultantDetailsActive] = useState<boolean | undefined>(
    undefined
  );
  const [savingConsultant, setSavingConsultant] = useState(false);
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
    scopeId: selectedConsultantId,
    endpoints: {
      list: `/api/users/${selectedConsultantId}/allocations`,
      item: (clientId) => `/api/users/${selectedConsultantId}/allocations/${clientId}`,
    },
  });

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/users', { params: { roleId: 3, includeInactive: true } })
      .then((response) => setConsultants(response.data.data || []))
      .catch(() => setConsultants([]));
    api
      .get('/api/users', { params: { roleId: 2, includeInactive: true } })
      .then((response) => setManagers(response.data.data || []))
      .catch(() => setManagers([]));
    api
      .get('/api/clients', { params: { includeInactive: true } })
      .then((response) => setClients(response.data.data || []))
      .catch(() => setClients([]));
  }, [user]);

  useEffect(() => {
    if (consultants.length === 0) return;
    if (!initialSelectionApplied.current) {
      const initialId = Number(searchParams.get('consultantId') || 0);
      if (initialId && consultants.some((consultant) => consultant.id === initialId)) {
        setSelectedConsultantId(initialId);
      } else if (selectedConsultantId === 0) {
        setSelectedConsultantId(consultants[0]?.id ?? 0);
      }
      initialSelectionApplied.current = true;
      return;
    }
    if (selectedConsultantId === 0) {
      setSelectedConsultantId(consultants[0]?.id ?? 0);
    }
  }, [consultants, selectedConsultantId, searchParams]);

  useEffect(() => {
    if (!selectedConsultantId) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('consultantId', String(selectedConsultantId));
        return next;
      },
      { replace: true }
    );

    api
      .get(`/api/users/${selectedConsultantId}`)
      .then((response) => {
        const data = response.data.data;
        if (data?.roleId && data.roleId !== 3) {
          setConsultantDetailsActive(undefined);
          setError('Selecione um consultor válido.');
          return;
        }
        setConsultantDetailsActive(data.isActive ?? true);
        setConsultantForm({
          name: data.name ?? '',
          email: data.email ?? '',
          isActive: data.isActive ?? true,
        });
        setConsultantManagerId(data.managerId ?? 0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar consultor');
        setConsultantDetailsActive(undefined);
      });

    api
      .get(`/api/users/${selectedConsultantId}/clients`, { params: { includeHistorical: false } })
      .then((response) =>
        setSelectedClientIds((response.data.data || []).map((c: ClientLinkRow) => c.id))
      )
      .catch(() => setSelectedClientIds([]));
  }, [selectedConsultantId, setSearchParams]);

  const handleSaveConsultant = async () => {
    if (!selectedConsultantId) return;
    const changedStatus =
      consultantDetailsActive !== undefined && consultantDetailsActive !== consultantForm.isActive;
    if (changedStatus) {
      const confirmed = window.confirm(
        `Tem certeza que deseja ${consultantForm.isActive ? 'ativar' : 'desativar'} este consultor?`
      );
      if (!confirmed) return;
    }
    setSavingConsultant(true);
    try {
      await api.put(`/api/users/${selectedConsultantId}`, {
        name: consultantForm.name,
        email: consultantForm.email,
        managerId: consultantManagerId || null,
        isActive: consultantForm.isActive,
      });
      setConsultantDetailsActive(consultantForm.isActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar consultor');
    } finally {
      setSavingConsultant(false);
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
        await api.delete(`/api/users/${selectedConsultantId}/clients/${clientIdToToggle}`);
      } else {
        await api.post(`/api/users/${selectedConsultantId}/clients/${clientIdToToggle}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar clientes');
    }
  };

  return (
    <AppShell
      title={translateUi('Consultores (Admin)')}
      subtitle={translateUi('Defina horas alocadas para consultores')}
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
          scopeLabel="consultor"
          year={year}
          years={years}
          onYearChange={setYear}
          month={month}
          monthOptions={monthOptions}
          onMonthChange={setMonth}
          scopeOptions={consultants}
          scopeId={selectedConsultantId}
          onScopeChange={setSelectedConsultantId}
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
            personLabel="consultor"
            form={consultantForm}
            onFormChange={(updater) => setConsultantForm(updater)}
            onSave={handleSaveConsultant}
            saving={savingConsultant}
            managerSelect={{
              managerId: consultantManagerId,
              managerOptions: managers,
              onManagerChange: setConsultantManagerId,
            }}
            clients={clients}
            selectedClientIds={selectedClientIds}
            onToggleClient={toggleClient}
          />
        </AllocationTable>
      )}
    </AppShell>
  );
};

export default ManagerConsultantsPage;
