import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flows: vi.fn(),
  projectFindUnique: vi.fn(),
  clientFindUnique: vi.fn(),
  entryFindMany: vi.fn(),
  entryCount: vi.fn(),
  closingFindFirst: vi.fn(),
  updateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../access-control/application/access-control.service.js', () => ({
  getFlows: mocks.flows,
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    client: { findUnique: mocks.clientFindUnique },
    timeEntry: {
      findMany: mocks.entryFindMany,
      count: mocks.entryCount,
      updateMany: mocks.updateMany,
    },
    closingPeriod: { findFirst: mocks.closingFindFirst },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

import {
  classifyLegacyEntriesForProject,
  previewLegacyEntriesWithoutProject,
} from './legacy-project-classify.service.js';

const openDate = new Date(Date.UTC(2026, 8, 10));
const openNow = new Date(Date.UTC(2026, 8, 5));

describe('legacy-project-classify.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flows.mockResolvedValue({ projects: true });
    mocks.projectFindUnique.mockResolvedValue({
      id: 5,
      clientId: 1,
      state: 'ACTIVE',
      code: 'PORTAL',
      name: 'Portal',
    });
    mocks.clientFindUnique.mockResolvedValue({ id: 1, lockDay: 25 });
    mocks.closingFindFirst.mockResolvedValue(null);
    mocks.entryCount.mockResolvedValue(1);
    mocks.auditCreate.mockResolvedValue({ id: 1 });
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        timeEntry: { updateMany: mocks.updateMany },
        auditLog: { create: mocks.auditCreate },
      })
    );
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it('prévia lista só lançamentos sem projectId do cliente do projeto', async () => {
    mocks.entryFindMany.mockResolvedValue([
      {
        id: 11,
        clientId: 1,
        projectId: null,
        date: openDate,
        deletedAt: null,
        userId: 3,
        activityDescription: 'legado',
        durationMinutes: 60,
      },
    ]);

    const preview = await previewLegacyEntriesWithoutProject(5, { limit: 50, now: openNow });
    expect(preview.projectId).toBe(5);
    expect(preview.clientId).toBe(1);
    expect(preview.totalWithoutProject).toBe(1);
    expect(preview.entries).toHaveLength(1);
    expect(preview.entries[0]).toMatchObject({ id: 11, decision: 'eligible' });
    expect(mocks.entryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 1, projectId: null, deletedAt: null }),
      })
    );
  });

  it('apply atribui projeto elegíveis, reporta conflitos e audita', async () => {
    const lockedDate = new Date(Date.UTC(2026, 7, 10)); // August — locked vs September now
    const lockedNow = new Date(Date.UTC(2026, 9, 2));
    mocks.entryFindMany.mockResolvedValue([
      {
        id: 11,
        clientId: 1,
        projectId: null,
        date: openDate,
        deletedAt: null,
        userId: 3,
      },
      {
        id: 12,
        clientId: 1,
        projectId: null,
        date: lockedDate,
        deletedAt: null,
        userId: 3,
      },
    ]);

    const result = await classifyLegacyEntriesForProject({
      projectId: 5,
      entryIds: [11, 12],
      actorUserId: 9,
      dryRun: false,
      now: openNow,
    });

    expect(result.assignedIds).toEqual([11]);
    expect(result.conflicts).toEqual([{ entryId: 12, reason: 'MONTH_LOCKED' }]);
    expect(mocks.updateMany).toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'CLASSIFY_LEGACY_PROJECT',
        userId: 9,
      }),
    });

    vi.clearAllMocks();
    mocks.flows.mockResolvedValue({ projects: true });
    mocks.projectFindUnique.mockResolvedValue({
      id: 5,
      clientId: 1,
      state: 'ACTIVE',
      code: 'PORTAL',
      name: 'Portal',
    });
    mocks.clientFindUnique.mockResolvedValue({ id: 1, lockDay: 25 });
    mocks.closingFindFirst.mockResolvedValue(null);
    mocks.entryFindMany.mockResolvedValue([
      {
        id: 11,
        clientId: 1,
        projectId: null,
        date: openDate,
        deletedAt: null,
        userId: 3,
      },
      {
        id: 12,
        clientId: 1,
        projectId: null,
        date: lockedDate,
        deletedAt: null,
        userId: 3,
      },
    ]);
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        timeEntry: { updateMany: mocks.updateMany },
        auditLog: { create: mocks.auditCreate },
      })
    );

    const lockedResult = await classifyLegacyEntriesForProject({
      projectId: 5,
      entryIds: [11, 12],
      actorUserId: 9,
      dryRun: false,
      now: lockedNow,
    });

    expect(lockedResult.assignedIds).toEqual([]);
    expect(lockedResult.conflicts.every((c) => c.reason === 'MONTH_LOCKED')).toBe(true);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('dryRun não persiste nem audita escrita', async () => {
    mocks.entryFindMany.mockResolvedValue([
      {
        id: 11,
        clientId: 1,
        projectId: null,
        date: openDate,
        deletedAt: null,
        userId: 3,
      },
    ]);

    const result = await classifyLegacyEntriesForProject({
      projectId: 5,
      entryIds: [11],
      actorUserId: 9,
      dryRun: true,
      now: openNow,
    });

    expect(result.dryRun).toBe(true);
    expect(result.assignedIds).toEqual([11]);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('rejeita quando flow projects desligado', async () => {
    mocks.flows.mockResolvedValue({ projects: false });
    await expect(previewLegacyEntriesWithoutProject(5)).rejects.toMatchObject({
      message: 'FLOW_DISABLED',
    });
  });
});
