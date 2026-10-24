import { describe, expect, it } from 'vitest';
import {
  buildTimeEntryEstimateHistory,
  toDurationConfirmationHistoryItem,
  toEstimateRevisionHistoryItem,
} from './estimate-history.js';

describe('EST-02 estimate / confirmation history', () => {
  it('mapeia confirmacoes versionadas sem inventar Actual Tracked', () => {
    const item = toDurationConfirmationHistoryItem({
      id: 1,
      uuid: 'c-1',
      version: 2,
      confirmedMinutes: 120,
      estimatedMinutesSnapshot: 150,
      justification: 'ajuste',
      confirmedByUserId: 7,
      confirmedAt: new Date('2026-10-15T12:00:00.000Z'),
      previousConfirmationId: 9,
      estimateRevisionId: 3,
      workActivityId: 2,
    });

    expect(item).toEqual({
      id: 1,
      uuid: 'c-1',
      version: 2,
      confirmedMinutes: 120,
      estimatedMinutesSnapshot: 150,
      justification: 'ajuste',
      confirmedByUserId: 7,
      confirmedAt: new Date('2026-10-15T12:00:00.000Z'),
      previousConfirmationId: 9,
      estimateRevisionId: 3,
      workActivityId: 2,
    });
    expect(item).not.toHaveProperty('actualTrackedMinutes');
  });

  it('mapeia EstimateRevision com formula explicavel', () => {
    const item = toEstimateRevisionHistoryItem({
      id: 3,
      uuid: 'r-1',
      version: 1,
      baseMinutes: 120,
      factor: 1.25,
      rawMinutes: 150,
      suggestedMinutes: 150,
      roundingMode: 'NEAREST_MINUTE',
      parameterRevisionUuid: 'pr-1',
      origin: 'CATALOG',
      algorithmVersion: 'EST-01',
      authorUserId: 7,
      reason: null,
      previousRevisionId: null,
      createdAt: new Date('2026-10-14T10:00:00.000Z'),
    });

    expect(item.suggestedMinutes).toBe(150);
    expect(item.formula).toContain('120');
    expect(item.formula).toContain('1.25');
    expect(item).not.toHaveProperty('actualTrackedMinutes');
  });

  it('monta historico completo ordenado (mais recente primeiro) sem preencher medido', () => {
    const history = buildTimeEntryEstimateHistory({
      timeEntryId: 10,
      workActivityId: 2,
      actualTrackedDurationMinutes: null,
      confirmations: [
        {
          id: 1,
          uuid: 'c-1',
          version: 1,
          confirmedMinutes: 135,
          estimatedMinutesSnapshot: 150,
          justification: null,
          confirmedByUserId: 7,
          confirmedAt: new Date('2026-10-15T11:00:00.000Z'),
          previousConfirmationId: null,
          estimateRevisionId: 3,
          workActivityId: 2,
        },
        {
          id: 2,
          uuid: 'c-2',
          version: 2,
          confirmedMinutes: 120,
          estimatedMinutesSnapshot: 150,
          justification: 'correcao',
          confirmedByUserId: 7,
          confirmedAt: new Date('2026-10-15T12:00:00.000Z'),
          previousConfirmationId: 1,
          estimateRevisionId: 3,
          workActivityId: 2,
        },
      ],
      estimateRevisions: [
        {
          id: 3,
          uuid: 'r-1',
          version: 1,
          baseMinutes: 120,
          factor: 1.25,
          rawMinutes: 150,
          suggestedMinutes: 150,
          roundingMode: 'NEAREST_MINUTE',
          parameterRevisionUuid: null,
          origin: 'ONE_OFF',
          algorithmVersion: 'EST-01',
          authorUserId: 7,
          reason: 'ajuste',
          previousRevisionId: null,
          createdAt: new Date('2026-10-14T10:00:00.000Z'),
        },
      ],
    });

    expect(history.timeEntryId).toBe(10);
    expect(history.workActivityId).toBe(2);
    expect(history.actualTrackedMinutes).toBeNull();
    expect(history.durationConfirmations.map((c) => c.version)).toEqual([2, 1]);
    expect(history.estimateRevisions).toHaveLength(1);
    expect(history.durationConfirmations[0]).not.toHaveProperty('actualTrackedMinutes');
  });

  it('preserva zero medido quando a entrada ja tem TRACKED_ZERO (nao inventa)', () => {
    const history = buildTimeEntryEstimateHistory({
      timeEntryId: 10,
      workActivityId: null,
      actualTrackedDurationMinutes: 0,
      confirmations: [],
      estimateRevisions: [],
    });
    expect(history.actualTrackedMinutes).toBe(0);
  });

  it('inclui evidencias SRC-01 sem misturar com Actual Tracked', () => {
    const history = buildTimeEntryEstimateHistory({
      timeEntryId: 10,
      workActivityId: 2,
      actualTrackedDurationMinutes: null,
      confirmations: [],
      estimateRevisions: [],
      estimationReferences: [
        {
          id: 5,
          uuid: 'ref-1',
          provider: 'github',
          kind: 'COMMIT',
          externalId: 'abc123',
          repository: 'org/repo',
          title: 'feat',
          uri: null,
          collectedAt: new Date('2026-10-15T10:00:00.000Z'),
        },
      ],
    });

    expect(history.estimationReferences).toHaveLength(1);
    expect(history.estimationReferences[0].isActualTrackedEvidence).toBe(false);
    expect(history.actualTrackedMinutes).toBeNull();
  });
});
