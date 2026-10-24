/**
 * workspace layout spacing language (consultant dashboard):
 * - page stack ≈ --tt-gap-panel (1.5rem)
 * - filter row ≈ .tt-filter-controls / --tt-gap-cluster × --tt-gap-control
 * - year/month cluster ≈ .tt-filter-cluster
 * Shared CSS class names are included so landing gap tokens apply when present;
 * Tailwind fallbacks keep layout correct until that CSS is merged.
 */
export const timeEntriesListPageStackClass = 'tt-page-stack flex flex-col gap-6';
export const timeEntriesListPanelClass = 'tt-panel animate-fade-up';
export const timeEntriesListFiltersClass =
  'tt-filter-controls flex flex-wrap items-center gap-x-5 gap-y-3';
export const timeEntriesListFilterClusterClass =
  'tt-filter-cluster flex flex-wrap items-center gap-3';
export const timeEntriesListBodyClass = 'flex min-h-[12rem] flex-col justify-center';
export const timeEntriesListEmptyClass = 'py-6 text-sm text-tt-text-muted md:py-8';
export const timeEntriesListFooterClass = 'flex flex-col gap-3 border-t border-tt-border pt-5';
export const timeEntriesListTotalClass =
  'rounded-tt border border-tt-success bg-tt-success-soft px-4 py-3.5 text-sm font-medium text-tt-success';
export const timeEntriesListSelectClass =
  'rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm';
export const timeEntriesListEntryClass =
  'flex flex-wrap items-center justify-between gap-4 rounded-tt border border-tt-border bg-tt-surface px-4 py-3';
