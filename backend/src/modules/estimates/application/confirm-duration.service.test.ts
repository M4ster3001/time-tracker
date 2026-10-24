import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  confirmationFindFirst: vi.fn(),
  confirmationCreate: vi.fn(),
  estimateRevisionFindFirst: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  flows: vi.fn(),
  grants: vi.fn(),
  userFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    timeEntry: { findFirst: mocks.findFirst, update: mocks.update },
    durationConfirmation: {
      findFirst: mocks.confirmationFindFirst,
      create: mocks.confirmationCreate,
    },
    estimateRevision: { findFirst: mocks.estimateRevisionFindFirst },
    auditLog: { create: mocks.audit },
    user: { findMany: mocks.userFindMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../../access-control/application/access-control.service.js', () => ({
  getFlows: mocks.flows,
  getUserGrants: mocks.grants,
}));

import { confirmTimeEntryDuration } from './confirm-duration.service.js';

describe('confirmTimeEntryDuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flows.mockResolvedValue({ estimates: true });
    mocks.grants.mockResolvedValue([{ permission: 'estimates.confirm', scope: 'self' }]);
    mocks.userFindMany.mockResolvedValue([]);
    mocks.confirmationFindFirst.mockResolvedValue(null);
    mocks.estimateRevisionFindFirst.mockResolvedValue(null);
    mocks.confirmationCreate.mockResolvedValue({ id: 99, version: 1 });
    mocks.audit.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        durationConfirmation: { create: mocks.confirmationCreate },
        timeEntry: { update: mocks.update },
        auditLog: { create: mocks.audit },
      })
    );
  });

  it('confirma duracao do proprio lancamento, persiste versao 1 e registra auditoria', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 5,
      userId: 3,
      durationMinutes: 90,
      estimatedDurationMinutes: 150,
      confirmedDurationMinutes: null,
      workActivityId: null,
      deletedAt: null,
    });
    mocks.update.mockResolvedValue({ id: 5, confirmedDurationMinutes: 135, durationMinutes: 135 });

    await expect(
      confirmTimeEntryDuration({
        timeEntryId: 5,
        actorUserId: 3,
        actorRoleId: 3,
        confirmedMinutes: 135,
        justification: 'revisao',
      })
    ).resolves.toMatchObject({ confirmedDurationMinutes: 135 });

    expect(mocks.confirmationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          timeEntryId: 5,
          version: 1,
          confirmedMinutes: 135,
          estimatedMinutesSnapshot: 150,
          previousConfirmationId: null,
          justification: 'revisao',
        }),
      })
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({
          confirmedDurationMinutes: 135,
          durationMinutes: 135,
          estimatedDurationMinutes: 150,
          confirmedByUserId: 3,
        }),
      })
    );
    expect(mocks.audit).toHaveBeenCalled();
  });

  it('incrementa versao quando ja existe confirmacao anterior', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 5,
      userId: 3,
      durationMinutes: 135,
      estimatedDurationMinutes: 150,
      confirmedDurationMinutes: 135,
      workActivityId: 11,
      deletedAt: null,
    });
    mocks.confirmationFindFirst.mockResolvedValue({ id: 42, version: 1 });
    mocks.estimateRevisionFindFirst.mockResolvedValue({ id: 77, version: 1 });
    mocks.confirmationCreate.mockResolvedValue({ id: 43, version: 2 });
    mocks.update.mockResolvedValue({ id: 5, confirmedDurationMinutes: 120 });

    await confirmTimeEntryDuration({
      timeEntryId: 5,
      actorUserId: 3,
      actorRoleId: 3,
      confirmedMinutes: 120,
      justification: 'correcao',
    });

    expect(mocks.confirmationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 2,
          previousConfirmationId: 42,
          confirmedMinutes: 120,
          workActivityId: 11,
          estimateRevisionId: 77,
        }),
      })
    );
  });

  it('team: permite confirmar apontamento de consultor gerenciado', async () => {
    mocks.grants.mockResolvedValue([{ permission: 'estimates.confirm', scope: 'team' }]);
    mocks.userFindMany.mockResolvedValue([{ id: 9 }]);
    mocks.findFirst.mockResolvedValue({
      id: 5,
      userId: 9,
      durationMinutes: 60,
      estimatedDurationMinutes: null,
      confirmedDurationMinutes: null,
      workActivityId: null,
      deletedAt: null,
    });
    mocks.update.mockResolvedValue({ id: 5, confirmedDurationMinutes: 60 });

    await expect(
      confirmTimeEntryDuration({
        timeEntryId: 5,
        actorUserId: 2,
        actorRoleId: 2,
        confirmedMinutes: 60,
      })
    ).resolves.toMatchObject({ confirmedDurationMinutes: 60 });

    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [9] }, managerId: 2 },
      })
    );
  });

  it('team: bloqueia apontamento de usuario nao gerenciado (mesmo roleId gestor)', async () => {
    mocks.grants.mockResolvedValue([{ permission: 'estimates.confirm', scope: 'team' }]);
    mocks.userFindMany.mockResolvedValue([]);
    mocks.findFirst.mockResolvedValue({
      id: 5,
      userId: 9,
      durationMinutes: 60,
      estimatedDurationMinutes: null,
      confirmedDurationMinutes: null,
      workActivityId: null,
      deletedAt: null,
    });

    await expect(
      confirmTimeEntryDuration({
        timeEntryId: 5,
        actorUserId: 2,
        actorRoleId: 2,
        confirmedMinutes: 60,
      })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('self: bloqueia terceiros mesmo com roleId admin legado se grant for self', async () => {
    mocks.grants.mockResolvedValue([{ permission: 'estimates.confirm', scope: 'self' }]);
    mocks.findFirst.mockResolvedValue({
      id: 5,
      userId: 9,
      durationMinutes: 60,
      estimatedDurationMinutes: null,
      confirmedDurationMinutes: null,
      workActivityId: null,
      deletedAt: null,
    });

    await expect(
      confirmTimeEntryDuration({
        timeEntryId: 5,
        actorUserId: 1,
        actorRoleId: 1,
        confirmedMinutes: 60,
      })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('bloqueia quando o flow estimates esta desligado', async () => {
    mocks.flows.mockResolvedValue({ estimates: false });
    await expect(
      confirmTimeEntryDuration({
        timeEntryId: 1,
        actorUserId: 1,
        actorRoleId: 1,
        confirmedMinutes: 60,
      })
    ).rejects.toMatchObject({ message: 'FLOW_DISABLED' });
  });
});
