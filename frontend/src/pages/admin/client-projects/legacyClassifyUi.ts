/** PRJ-01 — helpers UI para classificação em lote do legado “Sem projeto”. */

export type LegacyConflictReason =
  | 'ALREADY_HAS_PROJECT'
  | 'CLIENT_MISMATCH'
  | 'MONTH_LOCKED'
  | 'CLOSED_PERIOD'
  | 'PROJECT_NOT_USABLE'
  | 'ENTRY_NOT_FOUND'
  | 'ENTRY_DELETED';

export type LegacyPreviewRow = {
  id: number;
  decision: 'eligible' | LegacyConflictReason | string;
};

export const eligibleEntryIdsFromPreview = (rows: LegacyPreviewRow[]): number[] =>
  rows.filter((row) => row.decision === 'eligible').map((row) => row.id);

export const conflictReasonMessage = (
  reason: string,
  locale: 'pt' | 'en'
): string => {
  const pt: Record<string, string> = {
    ALREADY_HAS_PROJECT: 'Já tem projeto — não reclassifica silenciosamente.',
    CLIENT_MISMATCH: 'Cliente do lançamento difere do projeto alvo.',
    MONTH_LOCKED:
      'Mês fechado pelo dia de corte. Use desbloqueio temporário ou corrija só períodos abertos.',
    CLOSED_PERIOD:
      'Período em conferência/aprovado. Peça desbloqueio temporário; não reclassifica por edição cadastral.',
    PROJECT_NOT_USABLE: 'Projeto não aceita lançamentos neste estado.',
    ENTRY_NOT_FOUND: 'Lançamento não encontrado.',
    ENTRY_DELETED: 'Lançamento excluído.',
  };
  const en: Record<string, string> = {
    ALREADY_HAS_PROJECT: 'Already has a project — not silently reclassified.',
    CLIENT_MISMATCH: 'Entry client differs from the target project.',
    MONTH_LOCKED:
      'Month locked by cut-off day. Use a temporary unlock or classify open periods only.',
    CLOSED_PERIOD:
      'Period in review/approved. Request a temporary unlock; not reclassified by catalog edits.',
    PROJECT_NOT_USABLE: 'Project is not accepting entries in this state.',
    ENTRY_NOT_FOUND: 'Time entry not found.',
    ENTRY_DELETED: 'Time entry was deleted.',
  };
  const map = locale === 'en' ? en : pt;
  return map[reason] || reason;
};

export const formatClassifyResultSummary = (
  result: {
    assignedIds: number[];
    conflicts: Array<{ entryId: number; reason: string }>;
    dryRun: boolean;
  },
  locale: 'pt' | 'en'
): string => {
  const assigned = result.assignedIds.length;
  const conflicts = result.conflicts.length;
  if (locale === 'en') {
    const prefix = result.dryRun ? 'Preview:' : 'Applied:';
    return `${prefix} ${assigned} assigned, ${conflicts} conflict(s).`;
  }
  const prefix = result.dryRun ? 'Prévia:' : 'Aplicado:';
  const assignedLabel = assigned === 1 ? '1 atribuído' : `${assigned} atribuídos`;
  const conflictLabel = conflicts === 1 ? '1 conflito' : `${conflicts} conflitos`;
  return `${prefix} ${assignedLabel}, ${conflictLabel}.`;
};

export const toggleEntrySelection = (selected: number[], entryId: number): number[] =>
  selected.includes(entryId)
    ? selected.filter((id) => id !== entryId)
    : [...selected, entryId];
