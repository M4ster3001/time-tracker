import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import InfoTooltip from '../../../components/InfoTooltip';
import SearchableSelect from '../../../components/SearchableSelect';
import api from '../../../services/api';
import { extractApiError, monthOptions } from '../../../utils/formatters';
import {
  buildExportRequestParams,
  shouldDisableExportButton,
} from './services/exportSelection.service';
import { useAuth } from '../../../contexts/AuthContext';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';

interface UserOption {
  id: number;
  name: string;
}

interface ClientOption {
  id: number;
  name: string;
  historicalOnly?: boolean;
}

interface ExportPeriod {
  month: number;
  year: number;
}

type AdminExportFormat = 'executive' | 'detailed';

const getPeriodKey = (period: ExportPeriod): string => `${period.year}-${period.month}`;

const ExportPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = useCapabilities();
  const exportRoleId = can('reports.export', 'all') ? 1 : can('reports.export', 'team') ? 2 : 3;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [consultantId, setConsultantId] = useState(0);
  const [clientId, setClientId] = useState(0);
  const [consultants, setConsultants] = useState<UserOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchByClient, setBatchByClient] = useState(false);
  const [ownSheetsOnly, setOwnSheetsOnly] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState<ExportPeriod[]>([]);
  const [adminExportFormat, setAdminExportFormat] = useState<AdminExportFormat>('executive');
  const selectedClient = useMemo(
    () => clients.find((item) => item.id === clientId),
    [clients, clientId]
  );

  const years = useMemo(() => [year - 2, year - 1, year, year + 1], [year]);

  useEffect(() => {
    const fetchFilters = async () => {
      if (!user) return;
      try {
        const response = await api.get('/api/export/options');
        setConsultants(response.data.data.users);
        setClients(response.data.data.clients);
        if (exportRoleId === 3) setConsultantId(0);
      } catch (err) {
        setError(extractApiError(err, 'Não foi possível carregar os filtros de exportação.'));
      }
    };

    fetchFilters();
  }, [user?.id, exportRoleId, year, month, clientId]);

  useEffect(() => {
    setClientId(0);
    setConsultantId(0);
    setBatchByClient(false);
  }, [year, month]);

  useEffect(() => {
    if (batchByClient) {
      setConsultantId(0);
    }
  }, [batchByClient]);

  useEffect(() => {
    if (ownSheetsOnly) {
      setBatchByClient(false);
      setConsultantId(0);
    }
  }, [ownSheetsOnly]);

  const addPeriod = () => {
    const next = { month, year };
    setSelectedPeriods((prev) => {
      if (prev.some((item) => getPeriodKey(item) === getPeriodKey(next))) return prev;
      return [...prev, next].sort((a, b) =>
        a.year === b.year ? a.month - b.month : a.year - b.year
      );
    });
  };

  const removePeriod = (period: ExportPeriod) => {
    setSelectedPeriods((prev) =>
      prev.filter((item) => getPeriodKey(item) !== getPeriodKey(period))
    );
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      if (
        shouldDisableExportButton({
          roleId: exportRoleId as 1 | 2 | 3 | undefined,
          batchByClient,
          clientId,
          selectedPeriodsCount: selectedPeriods.length,
        }) &&
        exportRoleId === 2
      ) {
        setError('Selecione um cliente para exportar o lote.');
        return;
      }

      if (
        shouldDisableExportButton({
          roleId: exportRoleId as 1 | 2 | 3 | undefined,
          batchByClient,
          clientId,
          selectedPeriodsCount: selectedPeriods.length,
        }) &&
        exportRoleId === 1
      ) {
        setError('Selecione ao menos um período para exportar.');
        return;
      }

      const requestSelection = buildExportRequestParams({
        roleId: exportRoleId as 1 | 2 | 3 | undefined,
        batchByClient,
        ownSheetsOnly,
        clientId,
        consultantId,
        userId: user?.id,
      });

      const response = await api.get('/api/export/time-entries', {
        params: {
          month: exportRoleId === 1 ? undefined : month,
          year: exportRoleId === 1 ? undefined : year,
          periods: exportRoleId === 1 ? JSON.stringify(selectedPeriods) : undefined,
          format: exportRoleId === 1 ? adminExportFormat : undefined,
          consultantId: requestSelection.consultantId,
          clientId: requestSelection.clientId,
          mode: exportRoleId === 2 && batchByClient ? 'client-consultants' : undefined,
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'] as string | undefined;
      const fileNameMatch = disposition?.match(/filename="?([^";]+)"?/);
      const fileName = fileNameMatch?.[1] ?? 'time-entries.xlsx';
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractApiError(err, 'Falha ao exportar os relatórios.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title={translateUi('Exportacao')} subtitle={translateUi('Baixe relatorios em Excel')}>
      <section className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          >
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          {exportRoleId === 1 ? (
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addPeriod}
                  className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action"
                >
                  {translateUi('Adicionar periodo')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriods([])}
                  className="rounded-2xl border border-tt-border bg-tt-surface px-4 py-2 text-sm font-semibold text-tt-warning"
                >
                  {translateUi('Limpar')}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedPeriods.length === 0 ? (
                  <p className="text-xs text-tt-text-muted">
                    {translateUi('Nenhum periodo selecionado.')}
                  </p>
                ) : (
                  selectedPeriods.map((period) => {
                    const monthLabel =
                      monthOptions.find((option) => option.value === period.month)?.label ??
                      period.month;
                    return (
                      <button
                        type="button"
                        key={getPeriodKey(period)}
                        onClick={() => removePeriod(period)}
                        className="rounded-full border border-tt-border bg-tt-warning-soft px-3 py-1 text-xs font-semibold text-tt-warning"
                      >
                        {monthLabel}/{period.year} ×
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          {exportRoleId === 1 ? (
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-tt-text-muted">
                <span>{translateUi('Formato de exportacao')}</span>
                <InfoTooltip
                  content={
                    adminExportFormat === 'executive'
                      ? 'Relatório agregado executivo.'
                      : 'Gera um XLSX por manager ou consultor com lançamentos no período.'
                  }
                />
              </div>
              <select
                value={adminExportFormat}
                onChange={(event) => setAdminExportFormat(event.target.value as AdminExportFormat)}
                className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm md:col-span-2"
              >
                <option value="executive">{translateUi('Executivo')}</option>
                <option value="detailed">{translateUi('Detalhado (Manager/Consultor)')}</option>
              </select>
            </div>
          ) : null}

          <SearchableSelect
            value={clientId}
            onChange={(value) => setClientId(Number(value))}
            className="w-full"
            options={[
              { value: 0, label: translateUi('Todos os clientes') },
              ...clients.map((client) => ({
                value: client.id,
                label: `${client.name}${client.historicalOnly ? '(historico)' : ''}`,
              })),
            ]}
            placeholder={translateUi('Todos os clientes')}
            searchPlaceholder={translateUi('Buscar cliente...')}
          />
          {exportRoleId !== 3 ? (
            <SearchableSelect
              value={consultantId}
              onChange={(value) => setConsultantId(Number(value))}
              className="w-full"
              disabled={exportRoleId === 2 && batchByClient}
              options={[
                { value: 0, label: translateUi('Todos os consultores') },
                ...consultants.map((consultant) => ({
                  value: consultant.id,
                  label: consultant.name,
                })),
              ]}
              placeholder={translateUi('Todos os consultores')}
              searchPlaceholder={translateUi('Buscar consultor...')}
            />
          ) : null}
          {exportRoleId === 2 ? (
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-tt-text-muted">
                <input
                  type="checkbox"
                  checked={batchByClient}
                  onChange={(event) => setBatchByClient(event.target.checked)}
                  disabled={ownSheetsOnly}
                />
                {translateUi('Exportar todos os consultores do cliente selecionado')}
              </label>
              <label className="flex items-center gap-2 text-sm text-tt-text-muted">
                <input
                  type="checkbox"
                  checked={ownSheetsOnly}
                  onChange={(event) => setOwnSheetsOnly(event.target.checked)}
                />
                {translateUi('Exportar somente minhas planilhas')}
              </label>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={
            loading ||
            (exportRoleId === 2 && batchByClient && clientId === 0) ||
            (exportRoleId === 1 && selectedPeriods.length === 0)
          }
          className="mt-6 rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action disabled:opacity-50"
        >
          {loading ? 'Exportando...' : 'Exportar'}
        </button>

        {error ? <p className="mt-2 text-xs text-tt-danger">{error}</p> : null}
        {exportRoleId === 2 && batchByClient && clientId === 0 ? (
          <p className="mt-2 text-xs text-tt-warning">
            {translateUi('Selecione um cliente para exportar o lote.')}
          </p>
        ) : null}
        {exportRoleId === 2 && ownSheetsOnly ? (
          <p className="mt-2 text-xs text-tt-text-muted">
            {translateUi('Apenas suas planilhas serao exportadas neste modo.')}
          </p>
        ) : null}
        {exportRoleId === 2 && !batchByClient && !ownSheetsOnly && consultantId === 0 ? (
          <p className="mt-2 text-xs text-tt-text-muted">
            {translateUi('Todos os consultores do seu time serao exportados.')}
          </p>
        ) : null}
        {clientId !== 0 && selectedClient?.historicalOnly ? (
          <p className="mt-2 text-xs font-semibold text-tt-warning">
            {translateUi(
              'Cliente historico/desvinculado: exportacao considera os lancamentos registrados no periodo.'
            )}
          </p>
        ) : null}
      </section>
    </AppShell>
  );
};

export default ExportPage;
