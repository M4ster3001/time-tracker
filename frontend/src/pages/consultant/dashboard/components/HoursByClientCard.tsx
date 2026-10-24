import React, { useMemo, useState } from 'react';
import { text } from '../../../../i18n';
import { formatMinutes } from '../../../../utils/formatters';
import {
  buildClientHoursView,
  type ClientHoursInput,
} from '../mappers/clientHours.mapper';

interface HoursByClientCardProps {
  clients: ClientHoursInput[];
}

interface HoursBarProps {
  workedMinutes: number;
  overtimeMinutes: number;
  scaleMinutes: number;
  thin?: boolean;
}

const HoursBar: React.FC<HoursBarProps> = ({
  workedMinutes,
  overtimeMinutes,
  scaleMinutes,
  thin = false,
}) => {
  const scale = Math.max(scaleMinutes, 1);
  const overtime = Math.min(Math.max(overtimeMinutes, 0), workedMinutes);
  const regular = workedMinutes - overtime;
  return (
    <div
      className={`flex w-full overflow-hidden rounded-full bg-tt-elevated ${thin ? 'h-2' : 'h-2.5'}`}
      role="img"
      aria-label={`${text('Normais', 'Regular')} ${formatMinutes(regular)} · ${text('Extras', 'Overtime')} ${formatMinutes(overtime)}`}
    >
      <div className="h-full bg-tt-action" style={{ width: `${(regular / scale) * 100}%` }} />
      <div className="h-full bg-tt-warning" style={{ width: `${(overtime / scale) * 100}%` }} />
    </div>
  );
};

const HoursByClientCard: React.FC<HoursByClientCardProps> = ({ clients }) => {
  const view = useMemo(() => buildClientHoursView(clients, text('Geral', 'General')), [clients]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showEmpty, setShowEmpty] = useState(false);
  const hasOvertime = view.groups.some((group) => group.overtimeMinutes > 0);
  const share = (minutes: number) =>
    view.totalWorkedMinutes > 0 ? Math.round((minutes / view.totalWorkedMinutes) * 100) : 0;

  return (
    <section
      className="rounded-tt border border-tt-border bg-tt-surface p-5 shadow-sm"
      aria-labelledby="hours-by-client-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 id="hours-by-client-title" className="text-lg font-semibold text-tt-text">
          {text('Horas por cliente', 'Hours by client')}
        </h3>
        {view.groups.length > 0 ? (
          <ul className="flex items-center gap-4 text-xs text-tt-text-muted" aria-label={text('Legenda', 'Legend')}>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-tt-action" aria-hidden="true" />
              {text('Normais', 'Regular')}
            </li>
            {hasOvertime ? (
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-tt-warning" aria-hidden="true" />
                {text('Extras', 'Overtime')}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {view.groups.length === 0 ? (
        <p className="mt-4 text-sm text-tt-text-muted">
          {text('Sem lançamentos neste período.', 'No entries in this period.')}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {view.groups.map((group) => {
            const isGroup = group.rows.length > 1;
            const isOpen = Boolean(expanded[group.key]);
            const panelId = `hours-group-${group.key.replace(/[^a-z0-9]+/gi, '-')}`;
            const header = (
              <>
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <span
                    className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-tt-text"
                    title={group.name}
                  >
                    {isGroup ? (
                      <span
                        aria-hidden="true"
                        className={`inline-block text-xs text-tt-text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      >
                        ▸
                      </span>
                    ) : null}
                    <span className="truncate">{group.name}</span>
                    {isGroup ? (
                      <span className="shrink-0 text-xs font-normal text-tt-text-muted">
                        · {group.rows.length} {text('projetos', 'projects')}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="font-mono text-sm font-semibold tabular-nums text-tt-text">
                      {formatMinutes(group.workedMinutes)}
                    </span>
                    <span className="w-9 text-right font-mono text-xs tabular-nums text-tt-text-muted">
                      {share(group.workedMinutes)}%
                    </span>
                  </span>
                </div>
                <div className="mt-1.5">
                  <HoursBar
                    workedMinutes={group.workedMinutes}
                    overtimeMinutes={group.overtimeMinutes}
                    scaleMinutes={view.maxGroupMinutes}
                  />
                </div>
              </>
            );

            return (
              <li key={group.key}>
                {isGroup ? (
                  <button
                    type="button"
                    className="block w-full rounded-tt-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-focus focus-visible:ring-offset-2 focus-visible:ring-offset-tt-surface"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setExpanded((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                  >
                    {header}
                  </button>
                ) : (
                  <div>{header}</div>
                )}

                {isGroup && isOpen ? (
                  <ul
                    id={panelId}
                    className="mt-3 space-y-3 border-l border-tt-border pl-4"
                    aria-label={group.name}
                  >
                    {group.rows.map((row) => (
                      <li key={row.clientId}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-tt-text-muted" title={row.clientName}>
                            {row.label}
                          </span>
                          <span className="flex shrink-0 items-baseline gap-2">
                            <span className="font-mono text-xs font-semibold tabular-nums text-tt-text">
                              {formatMinutes(row.workedMinutes)}
                            </span>
                            <span className="w-9 text-right font-mono text-xs tabular-nums text-tt-text-muted">
                              {share(row.workedMinutes)}%
                            </span>
                          </span>
                        </div>
                        <div className="mt-1">
                          <HoursBar
                            thin
                            workedMinutes={row.workedMinutes}
                            overtimeMinutes={row.overtimeMinutes}
                            scaleMinutes={view.maxGroupMinutes}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {view.emptyClients.length > 0 ? (
        <div className="mt-4 border-t border-tt-border pt-3">
          <button
            type="button"
            className="text-xs font-semibold text-tt-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-focus"
            aria-expanded={showEmpty}
            onClick={() => setShowEmpty((prev) => !prev)}
          >
            {showEmpty
              ? text('Ocultar clientes sem horas', 'Hide clients without hours')
              : text(
                  `${view.emptyClients.length} cliente(s) sem horas no período`,
                  `${view.emptyClients.length} client(s) without hours in this period`
                )}
          </button>
          {showEmpty ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {view.emptyClients.map((item) => (
                <li
                  key={item.clientId}
                  className="rounded-full bg-tt-elevated px-2.5 py-1 text-xs text-tt-text-muted"
                >
                  {item.clientName}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default HoursByClientCard;
