import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { monthOptions } from '../../../utils/formatters';
import AllocationTable from '../../shared/allocations/AllocationTable';
import { useAllocationEditor } from '../../shared/allocations/useAllocationEditor';
import {
  buildWorkingDays,
  formatEffectiveDate,
  getNextMonthEffectiveDate,
} from '../../shared/allocations/allocationDate.calculators';
import type { ScopeOption } from '../../shared/allocations/allocation.types';

const ManagerAllocationsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [consultants, setConsultants] = useState<ScopeOption[]>([]);
  const [selectedConsultantId, setSelectedConsultantId] = useState<number>(0);
  const initialSelectionApplied = useRef(false);

  const years = useMemo(() => [year - 1, year, year + 1], [year]);
  const workingDays = useMemo(() => buildWorkingDays(year, month), [year, month]);
  const defaultEffectiveFromLabel = useMemo(
    () => formatEffectiveDate(getNextMonthEffectiveDate()),
    []
  );

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/manager/consultants')
      .then((response) => setConsultants(response.data.data || []))
      .catch(() => setConsultants([]));
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
  }, [selectedConsultantId, setSearchParams]);

  const editor = useAllocationEditor({
    scopeId: selectedConsultantId,
    endpoints: {
      list: `/api/manager/consultants/${selectedConsultantId}/allocations`,
      item: (clientId) =>
        `/api/manager/consultants/${selectedConsultantId}/allocations/${clientId}`,
    },
  });

  return (
    <AppShell
      title={translateUi('Consultores do Time')}
      subtitle={translateUi('Defina horas alocadas por cliente')}
    >
      {editor.loading ? (
        <div className="rounded-tt border border-tt-border bg-tt-surface p-10 text-center text-tt-text-muted">
          {translateUi('Carregando alocacoes...')}
        </div>
      ) : editor.error ? (
        <div className="rounded-3xl border border-tt-danger bg-tt-danger-soft p-6 text-sm text-tt-danger">
          {editor.error}
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
        />
      )}
    </AppShell>
  );
};

export default ManagerAllocationsPage;
