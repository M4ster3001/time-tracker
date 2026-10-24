import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flows: vi.fn(),
  clientFind: vi.fn(),
  projectFind: vi.fn(),
  taskTypeFind: vi.fn(),
  activityCreate: vi.fn(),
  entryFind: vi.fn(),
  entryUpdate: vi.fn(),
  entryUpdateMany: vi.fn(),
  revisionFind: vi.fn(),
  revisionCreate: vi.fn(),
  activityFind: vi.fn(),
  paramSetFind: vi.fn(),
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    client: { findFirst: mocks.clientFind },
    project: { findFirst: mocks.projectFind },
    taskType: { findUnique: mocks.taskTypeFind },
    workActivity: { create: mocks.activityCreate, findUnique: mocks.activityFind },
    timeEntry: {
      findFirst: mocks.entryFind,
      update: mocks.entryUpdate,
      updateMany: mocks.entryUpdateMany,
    },
    estimateRevision: { findFirst: mocks.revisionFind, create: mocks.revisionCreate },
    estimationParameterSet: { findFirst: mocks.paramSetFind },
  },
}));

vi.mock('../../access-control/application/access-control.service.js', () => ({
  getFlows: mocks.flows,
}));

import {
  createEstimateRevisionForActivity,
  createWorkActivity,
} from './work-activity.service.js';

describe('work-activity.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flows.mockResolvedValue({ estimates: true });
    mocks.clientFind.mockResolvedValue({ id: 10 });
    mocks.activityCreate.mockResolvedValue({ id: 1, clientId: 10, title: 'Tarefa' });
  });

  it('cria WorkActivity e vincula time entry do mesmo cliente', async () => {
    mocks.entryFind.mockResolvedValue({ id: 50, clientId: 10, userId: 3 });
    mocks.entryUpdate.mockResolvedValue({});

    await createWorkActivity({
      actorUserId: 3,
      clientId: 10,
      title: 'Tarefa',
      timeEntryId: 50,
    });

    expect(mocks.activityCreate).toHaveBeenCalled();
    expect(mocks.entryUpdate).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { workActivityId: 1 },
    });
  });

  it('persiste EstimateRevision ONE_OFF sem mutar catalogo e sincroniza estimado nos lancamentos', async () => {
    mocks.activityFind.mockResolvedValue({ id: 1, taskTypeId: null, taskType: null });
    mocks.revisionFind.mockResolvedValue(null);
    mocks.revisionCreate.mockResolvedValue({ id: 9, version: 1, suggestedMinutes: 150 });
    mocks.entryUpdateMany.mockResolvedValue({ count: 2 });

    const result = await createEstimateRevisionForActivity({
      actorUserId: 3,
      workActivityId: 1,
      baseMinutes: 120,
      factor: 1.25,
      origin: 'ONE_OFF',
      reason: 'ajuste',
    });

    expect(result.mutatesCatalog).toBe(false);
    expect(result.syncedEntryCount).toBe(2);
    expect(mocks.revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 1,
          suggestedMinutes: 150,
          origin: 'ONE_OFF',
        }),
      })
    );
    expect(mocks.entryUpdateMany).toHaveBeenCalledWith({
      where: { workActivityId: 1, deletedAt: null },
      data: { estimatedDurationMinutes: 150 },
    });
  });
});
