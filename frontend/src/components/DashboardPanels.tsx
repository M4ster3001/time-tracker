import React from 'react';
import InfoTooltip from './InfoTooltip';

interface DashboardStatCardProps {
  label: string;
  value: string;
  description?: string;
  tone?: 'default' | 'success' | 'warning' | 'info';
  /** Larger value, for the one or two numbers that matter most on the page. */
  emphasis?: boolean;
  /** Zero/no data: shrinks and mutes the value and shows `emptyLabel` instead of a big "0m". */
  empty?: boolean;
  emptyLabel?: string;
  /** Short context line under the value (e.g. "62% of the 84h target"). */
  hint?: string;
  /** Thin progress bar (0-100) under the value. */
  progress?: number;
}

interface DashboardListCardProps {
  title: string;
  description?: string;
  items: Array<{
    id: string | number;
    title: string;
    detail?: string;
    badge?: string;
  }>;
  emptyMessage: string;
}

export interface TimelinePoint {
  label: string;
  value: number;
  caption?: string;
}

interface DashboardTimelineProps {
  title: string;
  description?: string;
  points: TimelinePoint[];
  footer?: string;
}

const toneMap: Record<NonNullable<DashboardStatCardProps['tone']>, string> = {
  default: 'border-tt-border bg-tt-surface text-tt-text',
  success: 'border-tt-success/40 bg-tt-success-soft text-tt-success',
  warning: 'border-tt-warning/40 bg-tt-warning-soft text-tt-warning',
  info: 'border-tt-info/40 bg-tt-info-soft text-tt-info',
};

const emptyToneClass = 'border-tt-border border-dashed bg-tt-surface text-tt-text-muted';

export const DashboardStatCard: React.FC<DashboardStatCardProps> = ({
  label,
  value,
  description,
  tone = 'default',
  emphasis = false,
  empty = false,
  emptyLabel,
  hint,
  progress,
}) => (
  <article
    className={`tt-metric-card rounded-tt border shadow-tt ${empty ? emptyToneClass : toneMap[tone]}`}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-tt-text-muted">{label}</p>
      {description ? <InfoTooltip content={description} variant="subtle" /> : null}
    </div>
    <p
      className={`mt-2 font-mono font-semibold tabular-nums ${
        empty
          ? 'text-lg text-tt-text-muted'
          : emphasis
            ? 'text-3xl leading-tight'
            : 'text-2xl leading-tight'
      }`}
    >
      {value}
    </p>
    {typeof progress === 'number' ? (
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-tt-elevated"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(100, Math.max(0, progress)))}
      >
        <div
          className="h-full rounded-full bg-current"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    ) : null}
    {empty && emptyLabel ? (
      <p className="mt-1 text-xs text-tt-text-muted">{emptyLabel}</p>
    ) : hint ? (
      <p className="mt-2 text-xs text-tt-text-muted">{hint}</p>
    ) : null}
  </article>
);

export const DashboardListCard: React.FC<DashboardListCardProps> = ({
  title,
  description,
  items,
  emptyMessage,
}) => (
  <article className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-tt">
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-lg font-semibold text-tt-text">{title}</h3>
      {description ? <InfoTooltip content={description} /> : null}
    </div>
    <div className="mt-4 space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-tt-text-muted">{emptyMessage}</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-tt border border-tt-border bg-tt-elevated px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-tt-text">{item.title}</p>
              {item.detail ? (
                <p className="mt-1 text-xs text-tt-text-muted">{item.detail}</p>
              ) : null}
            </div>
            {item.badge ? (
              <span className="rounded-full bg-tt-selection px-2.5 py-1 text-xs font-semibold text-tt-link">
                {item.badge}
              </span>
            ) : null}
          </div>
        ))
      )}
    </div>
  </article>
);

export const DashboardTimeline: React.FC<DashboardTimelineProps> = ({
  title,
  description,
  points,
  footer,
}) => {
  const maxValue = Math.max(1, ...points.map((point) => point.value));

  return (
    <article className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-tt">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-tt-text">{title}</h3>
        {description ? <InfoTooltip content={description} /> : null}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {points.map((point) => (
          <div
            key={point.label}
            className="rounded-tt border border-tt-border bg-tt-elevated px-3 py-4"
          >
            <div className="flex h-24 items-end justify-center">
              <div className="flex h-full w-full items-end justify-center rounded-tt-control bg-tt-surface px-2 py-2">
                <div
                  className="w-full rounded-full bg-tt-action transition-[height]"
                  style={{ height: `${Math.max(8, (point.value / maxValue) * 100)}%` }}
                />
              </div>
            </div>
            <p className="mt-3 text-center text-xs uppercase tracking-[0.18em] text-tt-text-muted">
              {point.label}
            </p>
            <p className="mt-1 text-center font-mono text-sm font-semibold tabular-nums text-tt-text">
              {point.caption}
            </p>
          </div>
        ))}
      </div>
      {footer ? <p className="mt-4 text-sm text-tt-text-muted">{footer}</p> : null}
    </article>
  );
};
