import { translate as translateUi } from '../i18n';
import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-tt-elevated ${className}`} aria-hidden="true" />
);

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 1, className = '' }) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`} />
    ))}
  </div>
);

interface SkeletonCardProps {
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ className = '' }) => (
  <div
    className={`rounded-tt border border-tt-border bg-tt-surface p-4 ${className}`}
    aria-hidden="true"
  >
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
    </div>
  </div>
);

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => (
  <div className={`space-y-3 ${className}`} aria-hidden="true">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div
        key={rowIndex}
        className="flex items-center justify-between rounded-tt border border-tt-border bg-tt-surface px-4 py-3"
      >
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton
            key={colIndex}
            className={`h-4 ${colIndex === 0 ? 'w-32' : colIndex === columns - 1 ? 'w-20' : 'w-24'}`}
          />
        ))}
      </div>
    ))}
  </div>
);

interface SkeletonListProps {
  count?: number;
  className?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({ count = 5, className = '' }) => (
  <div className={`space-y-3 ${className}`} role="status" aria-label="Carregando...">
    <span className="sr-only">{translateUi('Carregando...')}</span>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

// UX-01: Dashboard-specific skeleton
interface SkeletonDashboardProps {
  className?: string;
}

export const SkeletonDashboard: React.FC<SkeletonDashboardProps> = ({ className = '' }) => (
  <div className={`space-y-6 ${className}`} role="status" aria-label="Carregando dashboard...">
    <span className="sr-only">{translateUi('Carregando dashboard...')}</span>
    {/* Summary cards */}
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-tt border border-tt-border bg-tt-surface p-4"
          aria-hidden="true"
        >
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      ))}
    </div>
    {/* Chart area */}
    <div className="rounded-tt border border-tt-border bg-tt-surface p-4" aria-hidden="true">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="h-48 w-full" />
    </div>
    {/* Table area */}
    <SkeletonTable rows={4} columns={5} />
  </div>
);

// UX-01: Form skeleton
interface SkeletonFormProps {
  fields?: number;
  className?: string;
}

export const SkeletonForm: React.FC<SkeletonFormProps> = ({ fields = 4, className = '' }) => (
  <div className={`space-y-4 ${className}`} role="status" aria-label="Carregando formulário...">
    <span className="sr-only">{translateUi('Carregando formulario...')}</span>
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} aria-hidden="true">
        <Skeleton className="mb-1 h-3 w-20" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    ))}
    <Skeleton className="mt-4 h-10 w-24 rounded-xl" />
  </div>
);

// UX-01: Stats card skeleton
export const SkeletonStatsCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`rounded-tt border border-tt-border bg-tt-surface p-4 ${className}`}
    aria-hidden="true"
  >
    <Skeleton className="mb-2 h-3 w-24" />
    <Skeleton className="h-7 w-20" />
    <Skeleton className="mt-3 h-2 w-full rounded-full" />
  </div>
);

// UX-01: Page skeleton (combines header + content)
interface SkeletonPageProps {
  type?: 'list' | 'dashboard' | 'form';
  className?: string;
}

export const SkeletonPage: React.FC<SkeletonPageProps> = ({ type = 'list', className = '' }) => (
  <div className={`space-y-6 ${className}`} role="status" aria-label="Carregando página...">
    <span className="sr-only">{translateUi('Carregando pagina...')}</span>
    {/* Header with filters */}
    <div className="rounded-tt border border-tt-border bg-tt-surface p-6" aria-hidden="true">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-48 rounded-2xl" />
        <Skeleton className="h-10 w-32 rounded-2xl" />
        <Skeleton className="h-10 w-32 rounded-2xl" />
      </div>
    </div>
    {/* Content based on type */}
    {type === 'dashboard' && <SkeletonDashboard />}
    {type === 'form' && (
      <div className="rounded-tt border border-tt-border bg-tt-surface p-6">
        <SkeletonForm fields={5} />
      </div>
    )}
    {type === 'list' && (
      <div className="rounded-tt border border-tt-border bg-tt-surface p-6">
        <SkeletonList count={6} />
      </div>
    )}
  </div>
);

export default Skeleton;
