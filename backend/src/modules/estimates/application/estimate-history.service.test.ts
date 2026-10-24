import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flows: vi.fn(),
  entryFind: vi.fn(),
  confirmationFindMany: vi.fn(),
  revisionFindMany: vi.fn(),
  referenceFindMany: vi.fn(),
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    timeEntry: { findFirst: mocks.entryFind },
    durationConfirmation: { findMany: mocks.confirmationFindMany },
    estimateRevision: { findMany: mocks.revisionFindMany },
    estimationReference: { findMany: mocks.referenceFindMany },
  },
}));

vi.mock('../../access-control/application/access-control.service.js', () => ({
  getFlows: mocks.flows,
}));

import { getTimeEntryEstimateHistory } from './estimate-history.service.js';

describe('getTimeEntryEstimateHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flows.mockResolvedValue({ estimates: true });
  });

  it('retorna historico de confirmacoes e revisoes do apontamento', async () => {
    mocks.entryFind.mockResolvedValue({
      id: 10,
      userId: 3,
      workActivityId: 2,
      actualTrackedDurationMinutes: null,
      deletedAt: null,
    });
    mocks.confirmationFindMany.mockResolvedValue([
      {
        id: 2,
        uuid: 'c-2',
        version: 2,
        confirmedMinutes: 120,
        estimatedMinutesSnapshot: 150,
        justification: null,
        confirmedByUserId: 3,
        confirmedAt: new Date('2026-10-15T12:00:00.000Z'),
        previousConfirmationId: 1,
        estimateRevisionId: 5,
        workActivityId: 2,
      },
    ]);
    mocks.revisionFindMany.mockResolvedValue([
      {
        id: 5,
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
        authorUserId: 3,
        reason: null,
        previousRevisionId: null,
        createdAt: new Date('2026-10-14T10:00:00.000Z'),
      },
    ]);
    mocks.referenceFindMany.mockResolvedValue([
      {
        id: 8,
        uuid: 'ref-1',
        provider: 'github',
        kind: 'COMMIT',
        externalId: 'abc123',
        repository: 'org/repo',
        title: 'feat',
        uri: null,
        collectedAt: new Date('2026-10-15T09:00:00.000Z'),
      },
    ]);

    const history = await getTimeEntryEstimateHistory({
      timeEntryId: 10,
      actorUserId: 3,
      actorRoleId: 3,
    });

    expect(history.durationConfirmations).toHaveLength(1);
    expect(history.estimateRevisions).toHaveLength(1);
    expect(history.estimationReferences).toHaveLength(1);
    expect(history.estimationReferences[0].isActualTrackedEvidence).toBe(false);
    expect(history.actualTrackedMinutes).toBeNull();
    expect(mocks.revisionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workActivityId: 2 } })
    );
    expect(mocks.referenceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { timeEntryId: 10 } })
    );
  });

  it('bloqueia flow estimates desligado e acesso de terceiros', async () => {
    mocks.flows.mockResolvedValue({ estimates: false });
    await expect(
      getTimeEntryEstimateHistory({ timeEntryId: 1, actorUserId: 1, actorRoleId: 1 })
    ).rejects.toMatchObject({ message: 'FLOW_DISABLED' });

    mocks.flows.mockResolvedValue({ estimates: true });
    mocks.entryFind.mockResolvedValue({
      id: 10,
      userId: 9,
      workActivityId: null,
      actualTrackedDurationMinutes: null,
      deletedAt: null,
    });
    await expect(
      getTimeEntryEstimateHistory({ timeEntryId: 10, actorUserId: 3, actorRoleId: 3 })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });
});
