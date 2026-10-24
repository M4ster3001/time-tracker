import { describe, expect, it } from 'vitest';
import {
  classifyLegacyEntryForProject,
  MAX_LEGACY_CLASSIFY_BATCH,
  partitionClassifyDecisions,
  type LegacyClassifyConflictReason,
} from './legacy-project-classify.js';

const entryDate = new Date(Date.UTC(2026, 8, 10)); // 2026-09-10
const openNow = new Date(Date.UTC(2026, 8, 5)); // before lockDay in same month
const lockedNow = new Date(Date.UTC(2026, 9, 2)); // October — September locked

const baseEntry = {
  id: 11,
  clientId: 1,
  projectId: null as number | null,
  date: entryDate,
  deletedAt: null as Date | null,
};

const usableProject = {
  id: 5,
  clientId: 1,
  state: 'ACTIVE' as const,
};

describe('PRJ-01 legacy project classify rules', () => {
  it('marca elegível quando sem projeto, mesmo cliente, projeto utilizável e período aberto', () => {
    const decision = classifyLegacyEntryForProject({
      entry: baseEntry,
      targetProject: usableProject,
      lockDay: 25,
      isClosedPeriod: false,
      now: openNow,
    });
    expect(decision).toEqual({ status: 'eligible', entryId: 11 });
  });

  it('conflita quando já tem projeto (não reclassifica silenciosamente)', () => {
    const decision = classifyLegacyEntryForProject({
      entry: { ...baseEntry, projectId: 99 },
      targetProject: usableProject,
      lockDay: 25,
      isClosedPeriod: false,
      now: openNow,
    });
    expect(decision).toEqual({
      status: 'conflict',
      entryId: 11,
      reason: 'ALREADY_HAS_PROJECT' satisfies LegacyClassifyConflictReason,
    });
  });

  it('conflita em vínculo cruzado de cliente', () => {
    const decision = classifyLegacyEntryForProject({
      entry: { ...baseEntry, clientId: 2 },
      targetProject: usableProject,
      lockDay: null,
      isClosedPeriod: false,
      now: openNow,
    });
    expect(decision.status).toBe('conflict');
    if (decision.status === 'conflict') {
      expect(decision.reason).toBe('CLIENT_MISMATCH');
    }
  });

  it('conflita em mês/lockDay fechado (não reclassifica por edição cadastral)', () => {
    const decision = classifyLegacyEntryForProject({
      entry: baseEntry,
      targetProject: usableProject,
      lockDay: 25,
      isClosedPeriod: false,
      now: lockedNow,
    });
    expect(decision).toEqual({
      status: 'conflict',
      entryId: 11,
      reason: 'MONTH_LOCKED',
    });
  });

  it('conflita em período de fechamento REVIEW/publicado', () => {
    const decision = classifyLegacyEntryForProject({
      entry: baseEntry,
      targetProject: usableProject,
      lockDay: null,
      isClosedPeriod: true,
      now: openNow,
    });
    expect(decision).toEqual({
      status: 'conflict',
      entryId: 11,
      reason: 'CLOSED_PERIOD',
    });
  });

  it('conflita quando projeto não aceita lançamentos (PAUSED/ARCHIVED)', () => {
    for (const state of ['PAUSED', 'ARCHIVED', 'COMPLETED'] as const) {
      const decision = classifyLegacyEntryForProject({
        entry: baseEntry,
        targetProject: { ...usableProject, state },
        lockDay: null,
        isClosedPeriod: false,
        now: openNow,
      });
      expect(decision).toMatchObject({
        status: 'conflict',
        reason: 'PROJECT_NOT_USABLE',
      });
    }
  });

  it('conflita quando lançamento não existe ou está excluído', () => {
    expect(
      classifyLegacyEntryForProject({
        entry: null,
        targetProject: usableProject,
        lockDay: null,
        isClosedPeriod: false,
        requestedEntryId: 404,
      })
    ).toEqual({ status: 'conflict', entryId: 404, reason: 'ENTRY_NOT_FOUND' });

    expect(
      classifyLegacyEntryForProject({
        entry: { ...baseEntry, deletedAt: new Date() },
        targetProject: usableProject,
        lockDay: null,
        isClosedPeriod: false,
      })
    ).toEqual({ status: 'conflict', entryId: 11, reason: 'ENTRY_DELETED' });
  });

  it('particiona elegíveis e conflitos e rejeita lote acima do teto', () => {
    const decisions = [
      { status: 'eligible' as const, entryId: 1 },
      { status: 'conflict' as const, entryId: 2, reason: 'MONTH_LOCKED' as const },
      { status: 'eligible' as const, entryId: 3 },
    ];
    const partitioned = partitionClassifyDecisions(decisions);
    expect(partitioned.eligibleIds).toEqual([1, 3]);
    expect(partitioned.conflicts).toHaveLength(1);
    expect(MAX_LEGACY_CLASSIFY_BATCH).toBe(100);
    expect(() =>
      partitionClassifyDecisions(
        Array.from({ length: MAX_LEGACY_CLASSIFY_BATCH + 1 }, (_, i) => ({
          status: 'eligible' as const,
          entryId: i + 1,
        }))
      )
    ).toThrow(/LEGACY_CLASSIFY_BATCH_TOO_LARGE/);
  });
});
