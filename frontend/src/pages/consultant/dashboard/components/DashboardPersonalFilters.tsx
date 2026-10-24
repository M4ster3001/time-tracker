import { text, translate as translateUi } from '../../../../i18n';
import React, { type KeyboardEvent, type ReactNode } from 'react';
import { onTablistKeyDown } from '../../../../hooks/tablistKeyboard';
import { monthOptions } from '../../../../utils/formatters';
import type { ClientOption } from '../types/dashboardPersonal.types';

interface DashboardPersonalFiltersProps {
  viewMode: 'overview' | 'daily';
  layoutMode: 'simple' | 'complete';
  month: number;
  year: number;
  years: number[];
  clientId: number;
  clients: ClientOption[];
  dailyStartDate: string;
  dailyEndDate: string;
  onMonthChange: (value: number) => void;
  onYearChange: (value: number) => void;
  onClientChange: (value: number) => void;
  onViewModeChange: (value: 'overview' | 'daily') => void;
  onLayoutModeChange: (value: 'simple' | 'complete') => void;
  onDailyStartDateChange: (value: string) => void;
  onDailyEndDateChange: (value: string) => void;
  onTodayClick: () => void;
  quickRanges: Array<{ key: string; label: string; range: { start: string; end: string } }>;
  onQuickRangeClick: (start: string, end: string) => void;
}

interface SegmentedOption<T extends string> {
  value: T;
  /** DOM id, kept stable for focus management and tests. */
  id: string;
  label: string;
  content: ReactNode;
}

interface SegmentedProps<T extends string> {
  ariaLabel: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** `icon` renders a compact square toggle; `text` renders a labelled segmented control. */
  variant: 'text' | 'icon';
}

function Segmented<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  variant,
}: SegmentedProps<T>) {
  const buttonSize = variant === 'icon' ? 'h-9 w-9 justify-center' : 'min-h-9 px-3.5';
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-tt border border-tt-border bg-tt-elevated p-0.5 text-xs font-semibold"
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        onTablistKeyDown(event, {
          selectedIndex: options.findIndex((option) => option.value === value),
          length: options.length,
          selectIndex: (index) => {
            const next = options[index];
            if (!next) return;
            onChange(next.value);
            window.requestAnimationFrame(() => {
              document.getElementById(next.id)?.focus();
            });
          },
        });
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            id={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={variant === 'icon' ? option.label : undefined}
            title={option.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center rounded-tt-control transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-focus ${buttonSize} ${
              selected
                ? 'bg-tt-action text-tt-on-action shadow-sm'
                : 'text-tt-text-muted hover:bg-tt-surface hover:text-tt-text'
            }`}
          >
            {option.content}
          </button>
        );
      })}
    </div>
  );
}

const DensityIcon: React.FC<{ rows: 2 | 4 }> = ({ rows }) => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden="true">
    {(rows === 2 ? [6, 14] : [3.5, 8, 12, 16.5]).map((y) => (
      <path key={y} d={`M4 ${y}h12`} strokeWidth="1.8" strokeLinecap="round" />
    ))}
  </svg>
);

const selectClass =
  'h-9 rounded-tt border border-tt-border bg-tt-surface px-3 text-sm text-tt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-focus disabled:opacity-60';

const DashboardPersonalFilters: React.FC<DashboardPersonalFiltersProps> = ({
  viewMode,
  layoutMode,
  month,
  year,
  years,
  clientId,
  clients,
  dailyStartDate,
  dailyEndDate,
  onMonthChange,
  onYearChange,
  onClientChange,
  onViewModeChange,
  onLayoutModeChange,
  onDailyStartDateChange,
  onDailyEndDateChange,
  onTodayClick,
  quickRanges,
  onQuickRangeClick,
}) => {
  return (
    <section
      className="z-30 mb-5 md:sticky md:top-0 animate-fade-up rounded-tt border border-tt-border bg-tt-surface px-4 py-3 shadow-sm md:before:pointer-events-none md:before:absolute md:before:inset-x-0 md:before:-top-4 md:before:h-4 md:before:bg-tt-page"
      aria-label={translateUi('Filtros')}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {viewMode === 'overview' ? (
          <>
            <label htmlFor="dashboard-year" className="sr-only">
              {translateUi('Selecionar ano')}
            </label>
            <select
              id="dashboard-year"
              value={year}
              onChange={(event) => onYearChange(Number(event.target.value))}
              className={selectClass}
              aria-label="Selecionar ano"
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <label htmlFor="dashboard-month" className="sr-only">
              {translateUi('Selecionar mes')}
            </label>
            <select
              id="dashboard-month"
              value={month}
              onChange={(event) => onMonthChange(Number(event.target.value))}
              className={selectClass}
              aria-label="Selecionar mês"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label htmlFor="dashboard-start" className="sr-only">
              {translateUi('Data inicial')}
            </label>
            <input
              id="dashboard-start"
              type="date"
              value={dailyStartDate}
              onChange={(event) => onDailyStartDateChange(event.target.value)}
              className={selectClass}
              aria-label="Data inicial"
            />
            <span aria-hidden="true" className="text-tt-text-muted">
              →
            </span>
            <label htmlFor="dashboard-end" className="sr-only">
              {translateUi('Data final')}
            </label>
            <input
              id="dashboard-end"
              type="date"
              value={dailyEndDate}
              onChange={(event) => onDailyEndDateChange(event.target.value)}
              className={selectClass}
              aria-label="Data final"
            />
            <button
              type="button"
              onClick={onTodayClick}
              className="h-9 rounded-tt border border-tt-border px-3 text-xs font-semibold text-tt-link hover:bg-tt-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-focus"
            >
              {translateUi('Hoje')}
            </button>
            {quickRanges.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onQuickRangeClick(item.range.start, item.range.end)}
                className="h-9 rounded-full border border-tt-border px-3 text-[11px] font-semibold text-tt-text-muted hover:bg-tt-elevated hover:text-tt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-focus"
              >
                {item.label}
              </button>
            ))}
          </>
        )}

        <label htmlFor="dashboard-client" className="sr-only">
          {translateUi('Filtrar por cliente')}
        </label>
        <select
          id="dashboard-client"
          value={clientId}
          onChange={(event) => onClientChange(Number(event.target.value))}
          className={`${selectClass} min-w-[10rem] max-w-[16rem]`}
          disabled={clients.length === 0}
          aria-label="Filtrar por cliente"
        >
          <option value={0}>{translateUi('Todos os clientes')}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-3">
          <Segmented
            variant="text"
            ariaLabel="Modo de visualizacao"
            value={viewMode}
            onChange={onViewModeChange}
            options={[
              {
                value: 'overview',
                id: 'dashboard-view-overview',
                label: translateUi('Visao geral'),
                content: translateUi('Visao geral'),
              },
              {
                value: 'daily',
                id: 'dashboard-view-daily',
                label: translateUi('Dia a dia'),
                content: translateUi('Dia a dia'),
              },
            ]}
          />
          {viewMode === 'overview' ? (
            <Segmented
              variant="icon"
              ariaLabel="Densidade do dashboard"
              value={layoutMode}
              onChange={onLayoutModeChange}
              options={[
                {
                  value: 'simple',
                  id: 'dashboard-layout-simple',
                  label: `${translateUi('Visual simples')} — ${text('só o essencial', 'essentials only')}`,
                  content: <DensityIcon rows={2} />,
                },
                {
                  value: 'complete',
                  id: 'dashboard-layout-complete',
                  label: `${translateUi('Visual completo')} — ${text('todos os painéis', 'all panels')}`,
                  content: <DensityIcon rows={4} />,
                },
              ]}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default DashboardPersonalFilters;
