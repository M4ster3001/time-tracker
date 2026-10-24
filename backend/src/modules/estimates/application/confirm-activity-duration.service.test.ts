import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flows: vi.fn(),
  grants: vi.fn(),
  activityFind: vi.fn(),
  entryFindMany: vi.fn(),
  confirmationFindFirst: vi.fn(),
  confirmationCreate: vi.fn(),
  estimateRevisionFindFirst: vi.fn(),
  entryUpdate: vi.fn(),
  userFindMany: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    workActivity: { findUnique: mocks.activityFind },
    timeEntry: { findMany: mocks.entryFindMany, update: mocks.entryUpdate },
    durationConfirmation: {
      findFirst: mocks.confirmationFindFirst,
      create: mocks.confirmationCreate,
    },
    estimateRevision: { findFirst: mocks.estimateRevisionFindFirst },
    user: { findMany: mocks.userFindMany },
    auditLog: { create: mocks.audit },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../../access-control/application/access-control.service.js', () => ({
  getFlows: mocks.flows,
  getUserGrants: mocks.grants,
}));

import { confirmWorkActivityDuration } from './confirm-activity-duration.service.js';

describe('confirmWorkActivityDuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flows.mockResolvedValue({ estimates: true });
    mocks.grants.mockResolvedValue([{ permission: 'estimates.confirm', scope: 'self' }]);
    mocks.userFindMany.mockResolvedValue([]);
    mocks.activityFind.mockResolvedValue({ id: 11, clientId: 1, ownerUserId: 3 });
    mocks.estimateRevisionFindFirst.mockResolvedValue({ id: 77 });
    mocks.confirmationFindFirst.mockResolvedValue(null);
    mocks.confirmationCreate.mockImplementation(async ({ data }: { data: { version: number } }) => ({
      id: 100 + data.version,
      version: data.version,
    }));
    mocks.entryUpdate.mockImplementation(async ({ where }: { where: { id: number } }) => ({
      id: where.id,
    }));
    mocks.audit.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        durationConfirmation: { create: mocks.confirmationCreate },
        timeEntry: { update: mocks.entryUpdate },
        auditLog: { create: mocks.audit },
      })
    );
  });

  it('confirma atividade distribuindo entre apontamentos vinculados do mesmo dono', async () => {
    mocks.entryFindMany.mockResolvedValue([
      {
        id: 1,
        userId: 3,
        durationMinutes: 90,
        estimatedDurationMinutes: 100,
        confirmedDurationMinutes: null,
        workActivityId: 11,
        deletedAt: null,
      },
      {
        id: 2,
        userId: 3,
        durationMinutes: 30,
        estimatedDurationMinutes: 40,
        confirmedDurationMinutes: null,
        workActivityId: 11,
        deletedAt: null,
      },
    ]);

    const result = await confirmWorkActivityDuration({
      workActivityId: 11,
      actorUserId: 3,
      actorRoleId: 3,
      confirmedMinutes: 120,
      justification: 'atividade fechada',
    });

    expect(result.totalConfirmedMinutes).toBe(120);
    expect(result.confirmations).toHaveLength(2);
    expect(mocks.confirmationCreate).toHaveBeenCalledTimes(2);
    expect(mocks.entryUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CONFIRM_ACTIVITY_DURATION',
        }),
      })
    );
  });

  it('self: confirma apenas apontamentos proprios em atividade multi-user (partial)', async () => {
    mocks.activityFind.mockResolvedValue({ id: 11, clientId: 1, ownerUserId: 3 });
    mocks.entryFindMany.mockResolvedValue([
      {
        id: 1,
        userId: 3,
        durationMinutes: 60,
        estimatedDurationMinutes: null,
        confirmedDurationMinutes: null,
        workActivityId: 11,
        deletedAt: null,
      },
      {
        id: 2,
        userId: 9,
        durationMinutes: 60,
        estimatedDurationMinutes: null,
        confirmedDurationMinutes: null,
        workActivityId: 11,
        deletedAt: null,
      },
    ]);

    const result = await confirmWorkActivityDuration({
      workActivityId: 11,
      actorUserId: 3,
      actorRoleId: 3,
      confirmedMinutes: 60,
    });

    expect(result.partial).toBe(true);
    expect(result.skippedTimeEntryIds).toEqual([2]);
    expect(result.confirmations).toHaveLength(1);
    expect(result.confirmations[0]?.timeEntryId).toBe(1);
    expect(result.totalConfirmedMinutes).toBe(60);
    expect(mocks.confirmationCreate).toHaveBeenCalledTimes(1);
    expect(mocks.entryUpdate).toHaveBeenCalledTimes(1);
  });

  it('self: Forbidden quando multi-user sem apontamentos proprios', async () => {
    mocks.entryFindMany.mockResolvedValue([
      {
        id: 2,
        userId: 9,
        durationMinutes: 60,
        estimatedDurationMinutes: null,
        confirmedDurationMinutes: null,
        workActivityId: 11,
        deletedAt: null,
      },
    ]);

    await expect(
      confirmWorkActivityDuration({
        workActivityId: 11,
        actorUserId: 3,
        actorRoleId: 3,
        confirmedMinutes: 60,
      })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('team: confirma multi-user quando todos os donos sao gerenciados', async () => {
    mocks.grants.mockResolvedValue([{ permission: 'estimates.confirm', scope: 'team' }]);
    mocks.userFindMany.mockResolvedValue([{ id: 9 }]);
    mocks.entryFindMany.mockResolvedValue([
      {
        id: 1,
        userId: 2,
        durationMinutes: 60,
        estimatedDurationMinutes: null,
        confirmedDurationMinutes: null,
        workActivityId: 11,
        deletedAt: null,
      },
      {
        id: 2,
        userId: 9,
        durationMinutes: 60,
        estimatedDurationMinutes: null,
        confirmedDurationMinutes: null,
        workActivityId: 11,
        deletedAt: null,
      },
    ]);

    const result = await confirmWorkActivityDuration({
      workActivityId: 11,
      actorUserId: 2,
      actorRoleId: 2,
      confirmedMinutes: 120,
    });

    expect(result.confirmations).toHaveLength(2);
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [9] }, managerId: 2 },
      })
    );
  });

  it('all: confirma multi-user sem exigir vinculo de gestao', async () => {
    mocks.grants.mockResolvedValue([{ permission: 'estimates.confirm', scope: 'all' }]);
    mocks.entryFindMany.mockResolvedValue([
      {
        id: 1,
        userId: 3,
        durationMinutes: 60,
        estimatedDurationMinutes: null,
        confirmedDurationMinutes: null,
        workActivityId: 11,
        deletedAt: null,
      },
      {
        id: 2,
        userId: 9,
        durationMinutes: 60,
        estimatedDurationMinutes: null,
        confirmedDurationMinutes: null,
        workActivityId: 11,
        deletedAt: null,
      },
    ]);

    await expect(
      confirmWorkActivityDuration({
        workActivityId: 11,
        actorUserId: 1,
        actorRoleId: 1,
        confirmedMinutes: 120,
      })
    ).resolves.toMatchObject({ totalConfirmedMinutes: 120 });
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });

  it('bloqueia flow estimates desligado', async () => {
    mocks.flows.mockResolvedValue({ estimates: false });
    await expect(
      confirmWorkActivityDuration({
        workActivityId: 1,
        actorUserId: 1,
        actorRoleId: 1,
        confirmedMinutes: 60,
      })
    ).rejects.toMatchObject({ message: 'FLOW_DISABLED' });
  });
});
