import { translate as translateUi } from '../../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import StateBanner from '../../../components/StateBanner';
import SearchableSelect from '../../../components/SearchableSelect';
import { SkeletonList } from '../../../components/Skeleton';
import { isAbortError } from '../../../utils/abort';
import { extractApiError, formatCurrency, monthOptions } from '../../../utils/formatters';
import {
  downloadHourPoolExport,
  fetchClientOptions,
  fetchConsultantOptions,
  fetchHourPoolReport,
} from './services/hourPool.service';
import type { HourPoolLineItem, HourPoolOption } from './types/hourPool.types';

const HourPoolPage: React.FC = () => {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<'client' | 'consultant'>('client');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const years = useMemo(() => [year - 1, year, year + 1], [year]);

  const [clients, setClients] = useState<HourPoolOption[]>([]);
  const [consultants, setConsultants] = useState<HourPoolOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(0);
  const [selectedConsultantId, setSelectedConsultantId] = useState(0);

  const [lineItems, setLineItems] = useState<HourPoolLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchClientOptions(controller.signal),
      fetchConsultantOptions(controller.signal),
    ])
      .then(([nextClients, nextConsultants]) => {
        setClients(nextClients);
        setConsultants(nextConsultants);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setClients([]);
        setConsultants([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchHourPoolReport({ year, month, signal: controller.signal })
      .then((items) => {
        setLineItems(items);
        if (!items.some((item) => item.clientId === selectedClientId)) {
          setSelectedClientId(items[0]?.clientId ?? 0);
        }
        if (!items.some((item) => item.consultantId === selectedConsultantId)) {
          setSelectedConsultantId(items[0]?.consultantId ?? 0);
        }
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(extractApiError(err, 'Falha ao carregar o bolsao de horas'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const clientRows = useMemo(
    () => lineItems.filter((item) => item.clientId === selectedClientId),
    [lineItems, selectedClientId]
  );
  const clientTotal = useMemo(
    () => clientRows.reduce((sum, item) => sum + (item.billableAmount ?? 0), 0),
    [clientRows]
  );

  const consultantRows = useMemo(
    () => lineItems.filter((item) => item.consultantId === selectedConsultantId),
    [lineItems, selectedConsultantId]
  );
  const consultantTotal = useMemo(
    () => consultantRows.reduce((sum, item) => sum + (item.billableAmount ?? 0), 0),
    [consultantRows]
  );

  const handleExport = async () => {
    if (!selectedClientId) return;
    setExporting(true);
    try {
      const { blob, fileName } = await downloadHourPoolExport({
        year,
        month,
        clientId: selectedClientId,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractApiError(err, 'Falha ao exportar o bolsao de horas'));
    } finally {
      setExporting(false);
    }
  };

  const renderRow = (item: HourPoolLineItem, label: string) => (
    <tr key={`${item.consultantId}-${item.clientId}`} className="border-t border-tt-border">
      <td className="px-2 py-3 font-semibold text-tt-text">{label}</td>
      <td className="px-2 py-3">{item.workedHours}h</td>
      <td className="px-2 py-3">{item.allocatedHours}h</td>
      <td className="px-2 py-3">
        {item.overtimeHours}h
        {!item.paysOvertime && item.overtimeHours > 0 ? (
          <span className="ml-2 rounded-tt bg-tt-elevated px-2 py-1 text-xs font-semibold uppercase tracking-wide text-tt-warning">
            {translateUi('nao faturada')}
          </span>
        ) : null}
      </td>
      <td className="px-2 py-3">{item.billableHours}h</td>
      <td className="px-2 py-3">
        {item.hourlyRate !== null ? (
          <span className="">{formatCurrency(item.hourlyRate)}</span>
        ) : (
          <span className="rounded-tt bg-tt-danger-soft px-2 py-1 text-xs font-semibold uppercase tracking-wide text-tt-danger">
            {translateUi('sem valor/hora')}
          </span>
        )}
      </td>
      <td className="px-2 py-3 font-semibold text-tt-action ">
        {item.billableAmount !== null ? formatCurrency(item.billableAmount) : '-'}
      </td>
    </tr>
  );

  return (
    <AppShell
      title={translateUi('Bolsão de Horas')}
      subtitle={translateUi(
        'Revise horas x valor/hora por cliente e por consultor antes de fechar o mes'
      )}
    >
      <section className="animate-fade-up rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('client')}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                activeTab === 'client'
                  ? 'bg-tt-action text-tt-on-action '
                  : 'border border-tt-border text-tt-warning '
              }`}
            >
              {translateUi('Por Cliente')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('consultant')}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                activeTab === 'consultant'
                  ? 'bg-tt-action text-tt-on-action '
                  : 'border border-tt-border text-tt-warning '
              }`}
            >
              {translateUi('Por Consultor')}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
          </div>
        </div>
      </section>

      {loading ? (
        <SkeletonList count={3} />
      ) : error ? (
        <StateBanner tone="error" message={error} />
      ) : activeTab === 'client' ? (
        <section className="animate-fade-up space-y-6">
          <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="w-full max-w-sm">
                <SearchableSelect
                  value={selectedClientId}
                  onChange={(value) => setSelectedClientId(Number(value))}
                  options={clients.map((client) => ({ label: client.name, value: client.id }))}
                  placeholder={translateUi('Selecione um cliente')}
                />
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={!selectedClientId || exporting}
                className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action disabled:opacity-60 "
              >
                {exporting ? 'Exportando...' : 'Exportar XLSX'}
              </button>
            </div>

            {clientRows.length === 0 ? (
              <p className="mt-4 text-sm text-tt-text-muted">
                {translateUi('Nenhum lancamento no ciclo fechado deste cliente neste periodo.')}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm text-tt-text">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.2em] text-tt-warning ">
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Consultor')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Horas Trabalhadas')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Horas Contratadas')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Horas Extras')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Horas Faturaveis')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Valor/Hora')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Total')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientRows.map((item) => renderRow(item, item.consultantName))}
                    <tr className="border-t border-tt-border font-semibold text-tt-text">
                      <td className="px-2 py-3" colSpan={6}>
                        {translateUi('Total do cliente')}
                      </td>
                      <td className="px-2 py-3 text-tt-action ">{formatCurrency(clientTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="animate-fade-up space-y-6">
          <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
            <div className="w-full max-w-sm">
              <SearchableSelect
                value={selectedConsultantId}
                onChange={(value) => setSelectedConsultantId(Number(value))}
                options={consultants.map((consultant) => ({
                  label: consultant.name,
                  value: consultant.id,
                }))}
                placeholder={translateUi('Selecione um consultor')}
              />
            </div>

            {consultantRows.length === 0 ? (
              <p className="mt-4 text-sm text-tt-text-muted">
                {translateUi('Nenhum lancamento no ciclo fechado deste consultor neste periodo.')}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm text-tt-text">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.2em] text-tt-warning ">
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Cliente')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Horas Trabalhadas')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Horas Contratadas')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Horas Extras')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Horas Faturaveis')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Valor/Hora')}
                      </th>
                      <th scope="col" className="px-2 py-3">
                        {translateUi('Total')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultantRows.map((item) => renderRow(item, item.clientName))}
                    <tr className="border-t border-tt-border font-semibold text-tt-text">
                      <td className="px-2 py-3" colSpan={6}>
                        {translateUi('Total do consultor')}
                      </td>
                      <td className="px-2 py-3 text-tt-action ">
                        {formatCurrency(consultantTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </AppShell>
  );
};

export default HourPoolPage;
