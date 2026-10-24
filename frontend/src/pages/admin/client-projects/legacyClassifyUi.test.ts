import { describe, expect, it } from 'vitest';
import {
  conflictReasonMessage,
  eligibleEntryIdsFromPreview,
  formatClassifyResultSummary,
  toggleEntrySelection,
  type LegacyPreviewRow,
} from './legacyClassifyUi';

const rows: LegacyPreviewRow[] = [
  { id: 1, decision: 'eligible' },
  { id: 2, decision: 'MONTH_LOCKED' },
  { id: 3, decision: 'eligible' },
  { id: 4, decision: 'CLOSED_PERIOD' },
];

describe('legacyClassifyUi PRJ-01', () => {
  it('seleciona só elegíveis da prévia', () => {
    expect(eligibleEntryIdsFromPreview(rows)).toEqual([1, 3]);
  });

  it('explica bloqueio de mês/fechamento com caminho permitido', () => {
    expect(conflictReasonMessage('MONTH_LOCKED', 'pt')).toMatch(/desbloqueio/i);
    expect(conflictReasonMessage('CLOSED_PERIOD', 'en')).toMatch(/temporary unlock/i);
    expect(conflictReasonMessage('ALREADY_HAS_PROJECT', 'pt')).toMatch(/já tem projeto/i);
  });

  it('resume resultado parcial com atribuídos e conflitos', () => {
    expect(
      formatClassifyResultSummary(
        { assignedIds: [1, 3], conflicts: [{ entryId: 2, reason: 'MONTH_LOCKED' }], dryRun: false },
        'pt'
      )
    ).toMatch(/2 atribuído/);
    expect(
      formatClassifyResultSummary(
        { assignedIds: [1], conflicts: [], dryRun: true },
        'en'
      )
    ).toMatch(/preview/i);
  });

  it('alterna seleção de id sem duplicar', () => {
    expect(toggleEntrySelection([1, 3], 2)).toEqual([1, 3, 2]);
    expect(toggleEntrySelection([1, 3], 1)).toEqual([3]);
  });
});
