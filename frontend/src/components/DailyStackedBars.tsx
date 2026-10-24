import { text, translate as translateUi } from '../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { formatMinutes } from '../utils/formatters';
import { dailyBarFocusKey, parseDailyBarFocusKey } from './dailyStackedBars.detail';

interface DailyEntryItem {
  id: number;
  userId: number;
  userName?: string;
  activityDescription: string;
  durationMinutes: number;
}

interface DailyClientBucket {
  clientId: number;
  clientName: string;
  minutes: number;
  entries: DailyEntryItem[];
}

export interface DailyBucket {
  date: string;
  totalMinutes: number;
  clients: DailyClientBucket[];
}

interface DailyStackedBarsProps {
  data: DailyBucket[];
  selectedClientId?: number;
  defaultScale?: 'client' | 'day';
  storageKey?: string;
}

const colorPalette = [
  'bg-tt-action',
  'bg-tt-warning',
  'bg-tt-info',
  'bg-tt-danger',
  'bg-tt-success',
  'bg-tt-link',
  'bg-tt-action-hover',
  'bg-tt-selection',
  'bg-tt-elevated',
];
const DAILY_BASELINE_MINUTES = 8 * 60;
const DAY_COLUMN_MIN_WIDTH = 64;
const CHART_MIN_WIDTH = 720;

const getClientColor = (clientId: number) => colorPalette[clientId % colorPalette.length];
const truncateText = (value: string, maxLength = 80) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
};

const DailyStackedBars: React.FC<DailyStackedBarsProps> = ({
  data,
  selectedClientId,
  defaultScale = 'client',
  storageKey,
}) => {
  const [scaleMode, setScaleMode] = useState<'client' | 'day'>(() => {
    if (!storageKey) return defaultScale;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'client' || stored === 'day') return stored;
    return defaultScale;
  });
  const [focusedBarKey, setFocusedBarKey] = useState<string | null>(null);
  const maxMinutes = useMemo(() => {
    return Math.max(
      1,
      ...data.map((day) => {
        if (selectedClientId) {
          return day.clients.find((client) => client.clientId === selectedClientId)?.minutes ?? 0;
        }
        if (scaleMode === 'day') {
          return day.totalMinutes;
        }
        if (day.clients.length === 0) return 0;
        return Math.max(...day.clients.map((client) => client.minutes));
      })
    );
  }, [data, selectedClientId, scaleMode]);
  const maxHours = Math.max(1, Math.ceil(maxMinutes / 60));
  const scaleMaxHours = Math.max(2, Math.ceil(maxHours / 2) * 2);
  const scaleTicks = Array.from(
    { length: scaleMaxHours / 2 + 1 },
    (_, index) => (scaleMaxHours - index * 2) * 60
  );
  const scaleMaxMinutes = scaleMaxHours * 60;
  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(storageKey, scaleMode);
  }, [scaleMode, storageKey]);
  const legendClients = Array.from(
    data.reduce((acc, day) => {
      day.clients.forEach((client) => {
        if (selectedClientId && client.clientId !== selectedClientId) return;
        acc.set(client.clientId, client.clientName);
      });
      return acc;
    }, new Map<number, string>())
  ).map(([clientId, clientName]) => ({ clientId, clientName }));
  const overtimeByDate = useMemo(
    () =>
      data.reduce((acc, day) => {
        acc.set(day.date, Math.max(0, day.totalMinutes - DAILY_BASELINE_MINUTES));
        return acc;
      }, new Map<string, number>()),
    [data]
  );
  const totalDailyOvertimeMinutes = useMemo(
    () =>
      data.reduce((acc, day) => acc + Math.max(0, day.totalMinutes - DAILY_BASELINE_MINUTES), 0),
    [data]
  );
  const overtimeDaysCount = useMemo(
    () => data.filter((day) => (overtimeByDate.get(day.date) ?? 0) > 0).length,
    [data, overtimeByDate]
  );
  const trackWidth = useMemo(
    () => Math.max(CHART_MIN_WIDTH, data.length * DAY_COLUMN_MIN_WIDTH),
    [data.length]
  );
  const focusedDetail = useMemo(() => {
    const parsed = parseDailyBarFocusKey(focusedBarKey);
    if (!parsed) return null;
    const day = data.find((row) => row.date === parsed.date);
    const client = day?.clients.find((row) => row.clientId === parsed.clientId);
    if (!day || !client) return null;
    if (selectedClientId && client.clientId !== selectedClientId) return null;
    return { day, client, overtime: overtimeByDate.get(day.date) ?? 0 };
  }, [data, focusedBarKey, overtimeByDate, selectedClientId]);

  return (
    <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-tt-text">{translateUi('Dia a dia')}</h3>
      <p className="mt-2 text-sm text-tt-text-muted">
        {text(
          'Passe o mouse ou foque uma barra com Tab/Enter para ver os lançamentos do dia por cliente.',
          'Hover or focus a bar with Tab/Enter to see that day’s entries by client.'
        )}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-tt-text-muted">
        <span>(unidade: horas)</span>
        <div
          className="flex items-center gap-2 rounded-tt-control border border-tt-border bg-tt-surface px-2 py-1 text-xs"
          role="group"
          aria-label={text('Escala do gráfico', 'Chart scale')}
        >
          <button
            type="button"
            onClick={() => setScaleMode('client')}
            className={`min-h-touch rounded-tt-control px-3 py-1 ${
              scaleMode === 'client' ? 'bg-tt-elevated text-tt-warning' : 'text-tt-text-muted'
            }`}
            aria-pressed={scaleMode === 'client'}
          >
            {translateUi('Por cliente')}
          </button>
          <button
            type="button"
            onClick={() => setScaleMode('day')}
            className={`min-h-touch rounded-tt-control px-3 py-1 ${
              scaleMode === 'day' ? 'bg-tt-elevated text-tt-warning' : 'text-tt-text-muted'
            }`}
            aria-pressed={scaleMode === 'day'}
          >
            {translateUi('Total do dia')}
          </button>
        </div>
      </div>
      {legendClients.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-tt-text-muted">
          {legendClients.map((client) => (
            <div key={client.clientId} className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${getClientColor(client.clientId)}`}
                aria-hidden
              />
              <span className="max-w-[140px] truncate" title={client.clientName}>
                {client.clientName}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-tt-elevated px-3 py-1 text-tt-text">
          {translateUi('Base diaria: 8h')}
        </span>
        <span className="rounded-full bg-tt-elevated px-3 py-1 font-semibold text-tt-warning">
          {translateUi('Extra no periodo (base 8h/dia):')}{' '}
          {formatMinutes(totalDailyOvertimeMinutes)}
        </span>
        <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">
          {translateUi('Dias com extra:')} {overtimeDaysCount}
        </span>
      </div>
      <div className="mt-6 grid gap-4">
        <div className="flex gap-4 overflow-x-auto overflow-y-visible pb-6">
          <div className="relative h-48 shrink-0 pr-2 text-[10px] text-tt-text-muted">
            {scaleTicks.map((minutes, index) => {
              const top = (1 - minutes / scaleMaxMinutes) * 100;
              return (
                <span
                  key={`${minutes}-${index}`}
                  className="absolute left-0 -translate-y-1/2"
                  style={{ top: `${top}%` }}
                >
                  {Math.round(minutes / 60)}
                </span>
              );
            })}
          </div>
          <div className="flex-1" style={{ minWidth: `${trackWidth}px` }}>
            <div
              className="relative h-48 rounded-2xl border border-tt-border bg-tt-warning-soft/50"
              style={{ minWidth: `${trackWidth}px` }}
            >
              {scaleTicks.map((minutes) => {
                const top = (1 - minutes / scaleMaxMinutes) * 100;
                return (
                  <div
                    key={`grid-${minutes}`}
                    className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-tt-border/70"
                    style={{ top: `${top}%` }}
                  />
                );
              })}
              <div className="absolute inset-0 flex items-end">
                {data.map((day) => {
                  const clients = selectedClientId
                    ? day.clients.filter((client) => client.clientId === selectedClientId)
                    : day.clients;
                  return (
                    <div
                      key={day.date}
                      className="flex h-full flex-1 items-end justify-center gap-1 px-2"
                      style={{ minWidth: `${DAY_COLUMN_MIN_WIDTH}px` }}
                    >
                      {clients.map((client) => {
                        const height = Math.min(100, (client.minutes / scaleMaxMinutes) * 100);
                        const dayOvertime = overtimeByDate.get(day.date) ?? 0;
                        const barKey = dailyBarFocusKey(day.date, client.clientId);
                        const isFocused = focusedBarKey === barKey;
                        const tooltipLines = client.entries.map((entry) => {
                          const userLabel = entry.userName ? `${entry.userName}: ` : '';
                          return `${userLabel}${truncateText(entry.activityDescription)} (${formatMinutes(
                            entry.durationMinutes
                          )})`;
                        });
                        const detailLabel = `${client.clientName} • ${formatMinutes(client.minutes)}`;
                        return (
                          <div
                            key={`${day.date}-${client.clientId}`}
                            className="group relative flex h-full w-4 items-end"
                          >
                            <button
                              type="button"
                              className={`w-full min-h-[8px] rounded-t-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-focus ${getClientColor(client.clientId)} ${
                                isFocused ? 'ring-2 ring-tt-focus' : ''
                              }`}
                              style={{ height: `${Math.max(height, 2)}%` }}
                              aria-label={detailLabel}
                              aria-expanded={isFocused}
                              aria-controls="daily-stacked-bars-detail"
                              title={detailLabel}
                              onFocus={() => setFocusedBarKey(barKey)}
                              onClick={() =>
                                setFocusedBarKey((prev) => (prev === barKey ? null : barKey))
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  setFocusedBarKey(null);
                                  (event.currentTarget as HTMLButtonElement).blur();
                                }
                              }}
                            />
                            <div
                              className={`pointer-events-none absolute left-1/2 bottom-full z-30 mb-2 w-64 -translate-x-1/2 rounded-tt border border-tt-border bg-tt-surface p-3 text-xs text-tt-text shadow-lg transition ${
                                isFocused
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100'
                              }`}
                              aria-hidden
                            >
                              <p className="font-semibold text-tt-text">{detailLabel}</p>
                              <p className="mt-1 text-[11px] text-tt-text-muted">
                                {translateUi('Total do dia:')} {formatMinutes(day.totalMinutes)}{' '}
                                {translateUi('· Extra:')} {formatMinutes(dayOvertime)}
                              </p>
                              <ul className="mt-2 space-y-1">
                                {tooltipLines.length === 0 ? (
                                  <li className="text-tt-text-muted">
                                    {translateUi('Sem lancamentos.')}
                                  </li>
                                ) : (
                                  tooltipLines.map((line, index) => (
                                    <li key={`${day.date}-${client.clientId}-${index}`}>{line}</li>
                                  ))
                                )}
                              </ul>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex">
              {data.map((day) => (
                <div
                  key={`${day.date}-label`}
                  className="flex-1 px-2 text-center text-xs text-tt-text-muted"
                  style={{ minWidth: `${DAY_COLUMN_MIN_WIDTH}px` }}
                >
                  <div>{day.date.slice(-2)}</div>
                  {(overtimeByDate.get(day.date) ?? 0) > 0 ? (
                    <div className="mt-1 text-[10px] font-semibold text-tt-danger">
                      +{formatMinutes(overtimeByDate.get(day.date) ?? 0)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          id="daily-stacked-bars-detail"
          className="rounded-tt border border-tt-border bg-tt-elevated p-3 text-sm text-tt-text"
          role="region"
          aria-live="polite"
          aria-label={text('Detalhe do dia selecionado', 'Selected day detail')}
        >
          {focusedDetail ? (
            <>
              <p className="font-semibold">
                {focusedDetail.client.clientName} • {formatMinutes(focusedDetail.client.minutes)}
              </p>
              <p className="mt-1 text-xs text-tt-text-muted">
                {focusedDetail.day.date} · {translateUi('Total do dia:')}{' '}
                {formatMinutes(focusedDetail.day.totalMinutes)} · {translateUi('· Extra:')}{' '}
                {formatMinutes(focusedDetail.overtime)}
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {focusedDetail.client.entries.length === 0 ? (
                  <li className="text-tt-text-muted">{translateUi('Sem lancamentos.')}</li>
                ) : (
                  focusedDetail.client.entries.map((entry) => (
                    <li key={entry.id}>
                      {entry.userName ? `${entry.userName}: ` : ''}
                      {truncateText(entry.activityDescription)} (
                      {formatMinutes(entry.durationMinutes)})
                    </li>
                  ))
                )}
              </ul>
            </>
          ) : (
            <p className="text-tt-text-muted">
              {text(
                'Selecione uma barra com o teclado ou o mouse para ver o detalhe.',
                'Select a bar with the keyboard or mouse to see the detail.'
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyStackedBars;
