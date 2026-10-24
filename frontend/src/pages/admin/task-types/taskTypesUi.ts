/** EST-01 — helpers de UI para catálogo de tipos de tarefa (workspace). */

export type TaskTypeAdminRow = {
  id: number;
  code: string;
  namePt: string;
  nameEn: string;
  description: string | null;
  isActive: boolean;
  activeBaseMinutes: number | null;
  activeFactor: number | null;
};

export type ParameterScopeKind = 'GLOBAL' | 'CLIENT' | 'PROJECT';

export type TaskTypeParameterSetRow = {
  id: number;
  scope: ParameterScopeKind;
  clientId: number | null;
  projectId: number | null;
  activeBaseMinutes: number | null;
  activeFactor: number | null;
};

export const PARAMETER_SCOPE_OPTIONS: ParameterScopeKind[] = ['GLOBAL', 'CLIENT', 'PROJECT'];

export const sortTaskTypesForDisplay = (rows: TaskTypeAdminRow[]): TaskTypeAdminRow[] =>
  [...rows].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.code.localeCompare(b.code);
  });

export const formatTaskTypeLabel = (
  row: Pick<TaskTypeAdminRow, 'code' | 'namePt' | 'nameEn'>,
  locale: 'pt' | 'en'
): string => {
  const name = locale === 'en' ? row.nameEn : row.namePt;
  return `${row.code} — ${name}`;
};

export const scopeNeedsClient = (scope: ParameterScopeKind): boolean =>
  scope === 'CLIENT' || scope === 'PROJECT';

export const scopeNeedsProject = (scope: ParameterScopeKind): boolean => scope === 'PROJECT';

export const formatParameterScopeLabel = (
  scope: ParameterScopeKind,
  locale: 'pt' | 'en'
): string => {
  if (scope === 'CLIENT') return locale === 'en' ? 'Client' : 'Cliente';
  if (scope === 'PROJECT') return locale === 'en' ? 'Project' : 'Projeto';
  return locale === 'en' ? 'Global' : 'Global';
};

export const formatParameterSetSummary = (
  row: TaskTypeParameterSetRow,
  locale: 'pt' | 'en'
): string => {
  const scope = formatParameterScopeLabel(row.scope, locale);
  const params =
    row.activeBaseMinutes == null || row.activeFactor == null
      ? '—'
      : `${row.activeBaseMinutes} × ${row.activeFactor}`;
  if (row.scope === 'PROJECT') {
    return `${scope} #${row.projectId ?? '?'} · ${params}`;
  }
  if (row.scope === 'CLIENT') {
    return `${scope} #${row.clientId ?? '?'} · ${params}`;
  }
  return `${scope} · ${params}`;
};
