import { describe, expect, it } from 'vitest';
import {
  assertReferenceNotActualTracked,
  buildEstimationReferenceKey,
  toEstimationReferenceHistoryItem,
  type EstimationReferenceInput,
} from './estimation-reference.js';

describe('SRC-01 estimation reference evidence', () => {
  it('deduplica por provedor + tipo + identificador estavel', () => {
    const input: EstimationReferenceInput = {
      provider: 'github',
      kind: 'COMMIT',
      externalId: 'abc123',
      repository: 'org/repo',
    };
    expect(buildEstimationReferenceKey(input)).toBe('github:COMMIT:org/repo:abc123');
    expect(
      buildEstimationReferenceKey({
        ...input,
        externalId: 'ABC123',
      })
    ).toBe('github:COMMIT:org/repo:abc123');
  });

  it('proibe apresentar referencia de commit/PR/issue como Actual Tracked Duration', () => {
    expect(() =>
      assertReferenceNotActualTracked({
        kind: 'COMMIT',
        presentAsActualTracked: true,
      })
    ).toThrow(/REFERENCE_NOT_ACTUAL_TRACKED/);

    expect(() =>
      assertReferenceNotActualTracked({
        kind: 'PULL_REQUEST',
        presentAsActualTracked: true,
      })
    ).toThrow(/REFERENCE_NOT_ACTUAL_TRACKED/);

    expect(() =>
      assertReferenceNotActualTracked({
        kind: 'ISSUE',
        presentAsActualTracked: false,
      })
    ).not.toThrow();
  });

  it('mapeia referencia para historico com disclaimer e sem minutos medidos', () => {
    const item = toEstimationReferenceHistoryItem({
      id: 5,
      uuid: 'ref-1',
      provider: 'github',
      kind: 'COMMIT',
      externalId: 'abc123',
      repository: 'org/repo',
      title: 'feat: endpoint',
      uri: 'https://example.com/abc123',
      collectedAt: new Date('2026-10-15T10:00:00.000Z'),
    });

    expect(item.kind).toBe('COMMIT');
    expect(item.isActualTrackedEvidence).toBe(false);
    expect(item).not.toHaveProperty('actualTrackedMinutes');
    expect(item.disclaimer).toMatch(/not Actual Tracked|nao e Actual Tracked/i);
  });
});
