import { text, translate as translateUi } from '../../../i18n';
import React, { useState, useMemo } from 'react';
import AppShell from '../../../components/AppShell';
import EmptyState from '../../../components/EmptyState';
import ScreenState from '../../../components/ScreenState';
import StateBanner from '../../../components/StateBanner';
import { extractApiError } from '../../../utils/formatters';
import { getInitialReportRange } from './constants';
import { formatUtilization, getUtilizationBg, getUtilizationColor } from './mappers';
import { getAdminReport } from './services';
import type { ClientCapacity, ConsultantPerformance, ReportType } from './types';

const AdminReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('consultant-performance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedFor, setGeneratedFor] = useState<ReportType | null>(null);

  // Filters
  const initialRange = useMemo(() => getInitialReportRange(), []);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);

  // Data
  const [consultantData, setConsultantData] = useState<ConsultantPerformance[]>([]);
  const [clientData, setClientData] = useState<ClientCapacity[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});

  // Expanded rows for detailed breakdown
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminReport(reportType, startDate, endDate);
      if (reportType === 'consultant-performance') {
        setConsultantData(response.data as ConsultantPerformance[]);
      } else {
        setClientData(response.data as ClientCapacity[]);
      }
      setSummary(response.summary);
      setGeneratedFor(reportType);
    } catch (err) {
      setError(extractApiError(err, text('Falha ao carregar relatório', 'Failed to load report')));
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const data = useMemo(() => {
    return reportType === 'consultant-performance' ? consultantData : clientData;
  }, [reportType, consultantData, clientData]);

  return (
    <AppShell
      title={translateUi('Relatorios')}
      subtitle={translateUi('Analise de performance e capacidade')}
    >
      {/* Filters */}
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] xl:items-end">
          <div className="min-w-0">
            <label htmlFor="report-type" className="mb-1 block text-sm font-medium text-tt-text">
              {translateUi('Tipo de Relatorio')}
            </label>
            <select
              id="report-type"
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as ReportType);
                setExpandedRows(new Set());
              }}
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
            >
              <option value="consultant-performance">
                {translateUi('Performance por Consultor')}
              </option>
              <option value="client-capacity">{translateUi('Capacidade por Cliente')}</option>
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="start-date" className="mb-1 block text-sm font-medium text-tt-text">
              {translateUi('Data Inicial')}
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="end-date" className="mb-1 block text-sm font-medium text-tt-text">
              {translateUi('Data Final')}
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="w-full rounded-2xl bg-tt-action px-6 py-2 text-sm font-semibold text-tt-on-action transition hover:bg-tt-action disabled:opacity-50 xl:w-auto"
          >
            {loading ? translateUi('Carregando...') : 'Gerar Relatório'}
          </button>
        </div>
      </section>

      {/* Error */}
      {error ? (
        <StateBanner
          tone="error"
          message={error}
          action={{ label: translateUi('Fechar'), onClick: () => setError(null) }}
        />
      ) : null}

      {/* Summary */}
      {Object.keys(summary).length > 0 && (
        <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {reportType === 'consultant-performance' ? (
            <>
              <div className="rounded-tt border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Total Consultores')}</p>
                <p className="text-2xl font-bold text-tt-text">{summary.totalConsultants}</p>
              </div>
              <div className="rounded-tt border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Utilizacao Media')}</p>
                <p
                  className={`text-2xl font-bold ${getUtilizationColor(summary.averageUtilization || 0)}`}
                >
                  {summary.averageUtilization}%
                </p>
              </div>
              <div className="rounded-tt border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">Sub-utilizados (&lt;80%)</p>
                <p className="text-2xl font-bold text-tt-warning ">{summary.underUtilized}</p>
              </div>
              <div className="rounded-tt border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">Sobre-alocados (&gt;100%)</p>
                <p className="text-2xl font-bold text-tt-info">{summary.overUtilized}</p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-tt border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Total Clientes')}</p>
                <p className="text-2xl font-bold text-tt-text">{summary.totalClients}</p>
              </div>
              <div className="rounded-tt border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Horas Restantes')}</p>
                <p className="text-2xl font-bold text-tt-success ">
                  {summary.totalRemainingHours}h
                </p>
              </div>
              <div className="rounded-tt border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Proximos do Limite')}</p>
                <p className="text-2xl font-bold text-tt-warning ">{summary.nearCapacity}</p>
              </div>
              <div className="rounded-tt border border-tt-border bg-tt-surface p-4">
                <p className="text-xs text-tt-text-muted">{translateUi('Acima da Capacidade')}</p>
                <p className="text-2xl font-bold text-tt-danger ">{summary.overCapacity}</p>
              </div>
            </>
          )}
        </section>
      )}

      {/* Data Table */}
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        {loading ? (
          <ScreenState
            variant="loading"
            title={translateUi('Carregando relatorio')}
            description="Buscando os dados mais recentes para o período selecionado."
            className="min-h-[240px]"
          />
        ) : data.length === 0 ? (
          <EmptyState
            variant="no-data"
            title={
              generatedFor === reportType
                ? text('Sem dados no período', 'No data in this period')
                : text('Pronto para gerar', 'Ready to generate')
            }
            description={
              generatedFor === reportType
                ? text(
                    'Nenhum lançamento encontrado. Ajuste o período e gere novamente.',
                    'No entries found. Adjust the period and generate again.'
                  )
                : text(
                    'Escolha o tipo e o período e clique em "Gerar relatório".',
                    'Pick the type and period, then click "Generate report".'
                  )
            }
          />
        ) : (
          <div className="space-y-3">
            {reportType === 'consultant-performance'
              ? // Consultant Performance Table
                consultantData.map((row) => (
                  <div key={row.userId}>
                    <div
                      className="grid cursor-pointer gap-4 rounded-tt border border-tt-border bg-tt-surface px-4 py-3 transition hover:bg-tt-warning-soft/50 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                      onClick={() => toggleRow(row.userId)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-tt-text">{row.userName}</p>
                        <p className="text-xs text-tt-text-muted">
                          {row.userEmail} {row.managerName && `· Gestor: ${row.managerName}`}
                        </p>
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-4 md:w-auto md:justify-end md:gap-6">
                        <div className="text-center">
                          <p className="text-xs text-tt-text-muted">{translateUi('Alocado')}</p>
                          <p className="text-sm font-semibold text-tt-text">
                            {row.allocatedHours}h
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-tt-text-muted">{translateUi('Trabalhado')}</p>
                          <p className="text-sm font-semibold text-tt-text">{row.workedHours}h</p>
                        </div>
                        <div
                          className={`rounded-full px-3 py-1 text-center ${getUtilizationBg(row.utilizationPercent)}`}
                        >
                          <p
                            className={`text-sm font-bold ${getUtilizationColor(row.utilizationPercent)}`}
                          >
                            {formatUtilization(row.utilizationPercent)}
                          </p>
                        </div>
                        <span className="text-tt-text-muted">
                          {expandedRows.has(row.userId) ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>
                    {expandedRows.has(row.userId) && (
                      <div className="ml-4 mt-2 space-y-2 border-l-2 border-tt-border pl-4">
                        <p className="text-xs font-semibold text-tt-text-muted">
                          {translateUi('Breakdown por Cliente:')}
                        </p>
                        {row.clientBreakdown.map((client) => (
                          <div
                            key={client.clientId}
                            className="flex items-center justify-between rounded-xl bg-tt-page px-3 py-2 text-sm"
                          >
                            <span className="text-tt-text">
                              {client.clientName} ({client.clientCode})
                            </span>
                            <span className={getUtilizationColor(client.utilizationPercent)}>
                              {client.workedHours}h / {client.allocatedHours}h (
                              {formatUtilization(client.utilizationPercent)})
                            </span>
                          </div>
                        ))}
                        {row.trend.length > 0 && (
                          <>
                            <p className="mt-3 text-xs font-semibold text-tt-text-muted">
                              {translateUi('Tendencia (ultimas 4 semanas):')}
                            </p>
                            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                              {row.trend.map((t, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-xl bg-tt-page p-2 text-center text-xs"
                                >
                                  <p className="text-tt-text-muted">{t.period.split(' - ')[0]}</p>
                                  <p
                                    className={`font-bold ${getUtilizationColor(t.utilizationPercent)}`}
                                  >
                                    {formatUtilization(t.utilizationPercent)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              : // Client Capacity Table
                clientData.map((row) => (
                  <div key={row.clientId}>
                    <div
                      className="grid cursor-pointer gap-4 rounded-tt border border-tt-border bg-tt-surface px-4 py-3 transition hover:bg-tt-warning-soft/50 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                      onClick={() => toggleRow(row.clientId)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-tt-text">{row.clientName}</p>
                        <p className="text-xs text-tt-text-muted">{row.clientCode}</p>
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-4 md:w-auto md:justify-end md:gap-6">
                        <div className="text-center">
                          <p className="text-xs text-tt-text-muted">{translateUi('Alocado')}</p>
                          <p className="text-sm font-semibold text-tt-text">
                            {row.totalAllocatedHours}h
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-tt-text-muted">{translateUi('Usado')}</p>
                          <p className="text-sm font-semibold text-tt-text">
                            {row.totalWorkedHours}h
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-tt-text-muted">{translateUi('Restante')}</p>
                          <p
                            className={`text-sm font-semibold ${row.remainingHours < 0 ? 'text-tt-danger ' : 'text-tt-success '}`}
                          >
                            {row.remainingHours}h
                          </p>
                        </div>
                        <div
                          className={`rounded-full px-3 py-1 text-center ${getUtilizationBg(row.utilizationPercent)}`}
                        >
                          <p
                            className={`text-sm font-bold ${getUtilizationColor(row.utilizationPercent)}`}
                          >
                            {formatUtilization(row.utilizationPercent)}
                          </p>
                        </div>
                        <span className="text-tt-text-muted">
                          {expandedRows.has(row.clientId) ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>
                    {expandedRows.has(row.clientId) && (
                      <div className="ml-4 mt-2 space-y-2 border-l-2 border-tt-border pl-4">
                        <p className="text-xs font-semibold text-tt-text-muted">
                          {translateUi('Breakdown por Consultor:')}
                        </p>
                        {row.consultantBreakdown.map((consultant) => (
                          <div
                            key={consultant.userId}
                            className="flex items-center justify-between rounded-xl bg-tt-page px-3 py-2 text-sm"
                          >
                            <span className="text-tt-text">{consultant.userName}</span>
                            <span className={getUtilizationColor(consultant.utilizationPercent)}>
                              {consultant.workedHours}h / {consultant.allocatedHours}h (
                              {formatUtilization(consultant.utilizationPercent)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
          </div>
        )}
      </section>
    </AppShell>
  );
};

export default AdminReportsPage;
