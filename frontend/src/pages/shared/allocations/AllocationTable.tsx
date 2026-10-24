import { translate as translateUi } from '../../../i18n';
import React from 'react';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import Pagination from '../../../components/Pagination';
import { formatMinutes } from '../../../utils/formatters';
import type { Notice } from '../../../hooks/useNotice';
import type { AllocationDraft, AllocationRow, ScopeOption } from './allocation.types';
import { computeMonthlyTargetMinutes } from './useAllocationEditor.logic';

export interface AllocationTableProps {
  scopeLabel: string;
  year: number;
  years: number[];
  onYearChange: (year: number) => void;
  month: number;
  monthOptions: { value: number; label: string }[];
  onMonthChange: (month: number) => void;
  scopeOptions: ScopeOption[];
  scopeId: number;
  onScopeChange: (id: number) => void;

  notice: Notice | null;
  effectiveFromLabel: string;

  rows: AllocationRow[];
  drafts: Record<number, AllocationDraft>;
  workingDays: number;
  saving: Record<number, boolean>;
  savingAll: boolean;
  onDraftChange: (clientId: number, field: keyof AllocationDraft, value: string) => void;
  onSave: (row: AllocationRow) => void;
  onClear: (row: AllocationRow) => void;
  onSaveAll: () => void;

  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;

  /** Conteudo extra renderizado entre o aviso de vigencia e a tabela (ex: PersonDetailsEditor). */
  children?: React.ReactNode;
}

/**
 * Bloco "Periodo e escopo" + aviso + tabela de alocacao + rodape "Salvar tudo" + paginacao.
 * Presentational puro: identico nas 3 telas de alocacao, so os dados/handlers mudam.
 */
const AllocationTable: React.FC<AllocationTableProps> = ({
  scopeLabel,
  year,
  years,
  onYearChange,
  month,
  monthOptions,
  onMonthChange,
  scopeOptions,
  scopeId,
  onScopeChange,
  notice,
  effectiveFromLabel,
  rows,
  drafts,
  workingDays,
  saving,
  savingAll,
  onDraftChange,
  onSave,
  onClear,
  onSaveAll,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  children,
}) => {
  const { can } = useCapabilities();
  const canWrite = can('allocations.write');
  const canReadRates = can('rates.read');
  const canWriteRates = can('rates.write');
  return (
    <>
      <section className="animate-fade-up rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
              {translateUi('Filtros')}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-tt-text">
              {translateUi('Periodo e')} {scopeLabel}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={year}
              onChange={(event) => onYearChange(Number(event.target.value))}
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(event) => onMonthChange(Number(event.target.value))}
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={scopeId}
              onChange={(event) => onScopeChange(Number(event.target.value))}
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
            >
              {scopeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="animate-fade-up space-y-6">
        {notice ? (
          <div
            className={`rounded-3xl border p-4 text-sm ${
              notice.type === 'success'
                ? 'border-tt-success bg-tt-success-soft text-tt-success'
                : 'border-tt-danger bg-tt-danger-soft text-tt-danger'
            }`}
          >
            {notice.message}
          </div>
        ) : null}
        <div className="rounded-3xl border border-tt-border bg-tt-warning-soft px-4 py-3 text-sm text-tt-warning">
          Alteracoes de alocacao feitas agora passam a valer a partir de{' '}
          <span className="font-semibold">{effectiveFromLabel}</span> (proximo mes).
        </div>

        {children}

        <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[760px] text-left text-sm text-tt-text">
              <thead className="sticky top-0 bg-tt-surface">
                <tr className="text-xs uppercase tracking-[0.2em] text-tt-warning">
                  <th className="px-2 py-3">{translateUi('Cliente')}</th>
                  <th className="px-2 py-3">{translateUi('Tipo')}</th>
                  <th className="px-2 py-3">{translateUi('Horas')}</th>
                  {canReadRates && <th className="px-2 py-3">{translateUi('Valor/Hora')}</th>}
                  <th className="px-2 py-3">{translateUi('Meta mensal')}</th>
                  <th className="px-2 py-3">{translateUi('Acoes')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const draft = drafts[row.clientId] ?? {
                    allocationType: 'DAILY' as const,
                    hours: '',
                    hourlyRate: '',
                  };
                  const monthlyTargetMinutes = computeMonthlyTargetMinutes(draft, workingDays);
                  return (
                    <tr key={row.clientId} className="border-t border-tt-border">
                      <td className="px-2 py-3 font-semibold text-tt-text">{row.clientName}</td>
                      <td className="px-2 py-3">
                        <select
                          disabled={!canWrite}
                          value={draft.allocationType}
                          onChange={(event) =>
                            onDraftChange(row.clientId, 'allocationType', event.target.value)
                          }
                          className="rounded-xl border border-tt-border bg-tt-surface px-3 py-2 text-sm"
                        >
                          <option value="DAILY">{translateUi('Horas por dia')}</option>
                          <option value="MONTHLY">{translateUi('Horas por mes')}</option>
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <input
                          disabled={!canWrite}
                          type="number"
                          min="0"
                          step="0.5"
                          value={draft.hours}
                          onChange={(event) =>
                            onDraftChange(row.clientId, 'hours', event.target.value)
                          }
                          placeholder="Ex: 4"
                          className="w-28 rounded-xl border border-tt-border bg-tt-surface px-3 py-2 text-sm"
                        />
                      </td>
                      {canReadRates && (
                        <td className="px-2 py-3">
                          <input
                            disabled={!canWrite || !canWriteRates}
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.hourlyRate}
                            onChange={(event) =>
                              onDraftChange(row.clientId, 'hourlyRate', event.target.value)
                            }
                            placeholder="Ex: 150.00"
                            className="w-28 rounded-xl border border-tt-border bg-tt-surface px-3 py-2 text-sm"
                          />
                        </td>
                      )}
                      <td className="px-2 py-3 text-sm font-semibold text-tt-success">
                        {monthlyTargetMinutes > 0 ? formatMinutes(monthlyTargetMinutes) : '-'}
                        <p className="mt-1 text-xs font-normal text-tt-text-muted">
                          {translateUi('Valido a partir de')} {effectiveFromLabel}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onSave(row)}
                            disabled={!canWrite || saving[row.clientId] || savingAll}
                            className="rounded-full border border-tt-success px-3 py-1 text-xs text-tt-success hover:bg-tt-selection disabled:opacity-60"
                          >
                            {translateUi('Salvar')}
                          </button>
                          <button
                            type="button"
                            onClick={() => onClear(row)}
                            disabled={!canWrite || saving[row.clientId] || savingAll}
                            className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning hover:bg-tt-warning-soft disabled:opacity-60"
                          >
                            {translateUi('Limpar')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-tt-text-muted">
              Dica: use &quot;Salvar tudo&quot; para gravar todas as linhas com horas validas.
            </p>
            <button
              type="button"
              onClick={onSaveAll}
              disabled={!canWrite || savingAll}
              className="rounded-full border border-tt-success px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-tt-success hover:bg-tt-selection disabled:opacity-60"
            >
              {savingAll ? translateUi('Salvando...') : 'Salvar tudo'}
            </button>
          </div>
        </div>

        {totalCount > 0 ? (
          <Pagination
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        ) : null}
      </section>
    </>
  );
};

export default AllocationTable;
