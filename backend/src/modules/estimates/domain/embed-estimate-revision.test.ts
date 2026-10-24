import { describe, expect, it } from 'vitest';
import {
  pickLatestEstimateRevision,
  withEmbeddedEstimateRevision,
  type EstimateRevisionSummary,
} from './embed-estimate-revision.js';

const rev = (
  overrides: Partial<EstimateRevisionSummary> & Pick<EstimateRevisionSummary, 'id' | 'version'>
): EstimateRevisionSummary => ({
  uuid: `u-${overrides.id}`,
  baseMinutes: 60,
  factor: 1.25,
  suggestedMinutes: 75,
  origin: 'CATALOG',
  algorithmVersion: 'EST-01',
  createdAt: new Date('2026-10-15T12:00:00.000Z'),
  ...overrides,
});

describe('EST-01 embed latest EstimateRevision on GET', () => {
  it('escolhe a revisao de maior version', () => {
    const latest = pickLatestEstimateRevision([
      rev({ id: 1, version: 1, suggestedMinutes: 60 }),
      rev({ id: 3, version: 3, suggestedMinutes: 90 }),
      rev({ id: 2, version: 2, suggestedMinutes: 75 }),
    ]);
    expect(latest?.id).toBe(3);
    expect(latest?.suggestedMinutes).toBe(90);
  });

  it('retorna null quando nao ha revisoes', () => {
    expect(pickLatestEstimateRevision([])).toBeNull();
    expect(pickLatestEstimateRevision(null)).toBeNull();
  });

  it('embute estimateRevision no payload do lancamento sem alterar duracoes', () => {
    const entry = {
      id: 10,
      durationMinutes: 120,
      workActivityId: 5,
      estimatedDurationMinutes: 90,
    };
    const embedded = withEmbeddedEstimateRevision(entry, [
      rev({ id: 7, version: 1, suggestedMinutes: 90 }),
    ]);
    expect(embedded.estimateRevision).toMatchObject({
      id: 7,
      version: 1,
      suggestedMinutes: 90,
    });
    expect(embedded.durationMinutes).toBe(120);
    expect(embedded.workActivityId).toBe(5);
  });

  it('embute null quando workActivityId existe mas sem revisao', () => {
    const embedded = withEmbeddedEstimateRevision(
      { id: 1, durationMinutes: 30, workActivityId: 9 },
      []
    );
    expect(embedded.estimateRevision).toBeNull();
  });
});
