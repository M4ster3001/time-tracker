import { describe, expect, it } from 'vitest';
import {
  applyEstimateRevision,
  createWorkActivityDraft,
  nextEstimateRevisionVersion,
} from './work-activity.js';

describe('WorkActivity + EstimateRevision', () => {
  it('cria atividade com versao 1 e estado OPEN', () => {
    const activity = createWorkActivityDraft({
      clientId: 10,
      title: 'Implementar endpoint',
      ownerUserId: 3,
      taskTypeCode: 'IMPLEMENTATION',
    });
    expect(activity.state).toBe('OPEN');
    expect(activity.version).toBe(1);
    expect(activity.title).toBe('Implementar endpoint');
    expect(activity.projectId).toBeNull();
  });

  it('rejeita titulo vazio', () => {
    expect(() =>
      createWorkActivityDraft({ clientId: 1, title: '  ', ownerUserId: 1 })
    ).toThrow(/WORK_ACTIVITY_TITLE_REQUIRED/);
  });

  it('grava EstimateRevision sem alterar catalogo (ONE_OFF) e preserva base/fator', () => {
    const revision = applyEstimateRevision({
      workActivityId: 1,
      previousVersion: null,
      baseMinutes: 120,
      factor: 1.25,
      suggestedMinutes: 150,
      rawMinutes: 150,
      origin: 'ONE_OFF',
      authorUserId: 7,
      reason: 'ajuste pontual',
    });
    expect(revision.version).toBe(1);
    expect(revision.origin).toBe('ONE_OFF');
    expect(revision.suggestedMinutes).toBe(150);
    expect(revision.mutatesCatalog).toBe(false);
    expect(revision.previousRevisionId).toBeNull();
  });

  it('incrementa versao de EstimateRevision e aponta precedente', () => {
    expect(nextEstimateRevisionVersion(2)).toBe(3);
    const revision = applyEstimateRevision({
      workActivityId: 1,
      previousVersion: 1,
      previousRevisionId: 99,
      baseMinutes: 120,
      factor: 1.1,
      suggestedMinutes: 132,
      rawMinutes: 132,
      origin: 'CATALOG',
      authorUserId: 7,
    });
    expect(revision.version).toBe(2);
    expect(revision.previousRevisionId).toBe(99);
  });
});
