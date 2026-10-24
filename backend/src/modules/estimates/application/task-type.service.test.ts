import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flows: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setCreate: vi.fn(),
  setFindFirst: vi.fn(),
  revisionCreate: vi.fn(),
  revisionFindFirst: vi.fn(),
  revisionUpdate: vi.fn(),
  clientFindUnique: vi.fn(),
  projectFindUnique: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    taskType: {
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      create: mocks.create,
      update: mocks.update,
    },
    client: { findUnique: mocks.clientFindUnique },
    project: { findUnique: mocks.projectFindUnique },
    estimationParameterSet: {
      create: mocks.setCreate,
      findFirst: mocks.setFindFirst,
    },
    estimationParameterRevision: {
      create: mocks.revisionCreate,
      findFirst: mocks.revisionFindFirst,
      update: mocks.revisionUpdate,
    },
    auditLog: { create: mocks.audit },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../../access-control/application/access-control.service.js', () => ({
  getFlows: mocks.flows,
}));

import {
  createTaskType,
  listTaskTypes,
  replaceTaskTypeGlobalParameters,
} from './task-type.service.js';

describe('task-type.service EST-01', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flows.mockResolvedValue({ estimates: true });
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        taskType: { create: mocks.create, update: mocks.update },
        estimationParameterSet: {
          create: mocks.setCreate,
          findFirst: mocks.setFindFirst,
        },
        estimationParameterRevision: {
          create: mocks.revisionCreate,
          findFirst: mocks.revisionFindFirst,
          update: mocks.revisionUpdate,
        },
        auditLog: { create: mocks.audit },
      })
    );
  });

  it('lista ativos por padrão e inclui parâmetros GLOBAL vigentes', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: 1,
        uuid: 'u1',
        code: 'IMPL',
        namePt: 'Impl',
        nameEn: 'Impl',
        description: null,
        isActive: true,
        parameterSets: [{ revisions: [{ baseMinutes: 60, factor: 1.5 }] }],
      },
    ]);
    const rows = await listTaskTypes({});
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    );
    expect(rows[0]).toMatchObject({
      code: 'IMPL',
      activeBaseMinutes: 60,
      activeFactor: 1.5,
    });
  });

  it('cria tipo com set GLOBAL e revisão inicial', async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({
      id: 9,
      uuid: 'u9',
      code: 'TESTS',
      namePt: 'Testes',
      nameEn: 'Tests',
      description: null,
      isActive: true,
    });
    mocks.setCreate.mockResolvedValue({ id: 3 });
    mocks.revisionCreate.mockResolvedValue({ id: 4 });
    mocks.audit.mockResolvedValue({});
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 9,
      uuid: 'u9',
      code: 'TESTS',
      namePt: 'Testes',
      nameEn: 'Tests',
      description: null,
      isActive: true,
      parameterSets: [{ revisions: [{ baseMinutes: 45, factor: 1.1 }] }],
    });

    const row = await createTaskType({
      actorUserId: 2,
      code: 'tests',
      namePt: 'Testes',
      nameEn: 'Tests',
      baseMinutes: 45,
      factor: 1.1,
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'TESTS', namePt: 'Testes' }),
      })
    );
    expect(mocks.setCreate).toHaveBeenCalled();
    expect(mocks.revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parameterSetId: 3,
          baseMinutes: 45,
          authorUserId: 2,
        }),
      })
    );
    expect(row.activeBaseMinutes).toBe(45);
    expect(row.activeFactor).toBe(1.1);
  });

  it('revisa parâmetros CLIENT com cliente válido e não GLOBAL', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 9,
      code: 'TESTS',
      namePt: 'Testes',
      nameEn: 'Tests',
    });
    mocks.clientFindUnique.mockResolvedValue({ id: 10, name: 'Acme' });
    mocks.setFindFirst.mockResolvedValue(null);
    mocks.setCreate.mockResolvedValue({ id: 33 });
    mocks.revisionFindFirst.mockResolvedValue(null);
    mocks.revisionCreate.mockResolvedValue({ id: 44 });
    mocks.audit.mockResolvedValue({});
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 9,
      uuid: 'u9',
      code: 'TESTS',
      namePt: 'Testes',
      nameEn: 'Tests',
      description: null,
      isActive: true,
      parameterSets: [{ revisions: [{ baseMinutes: 60, factor: 1 }] }],
    });

    const row = await replaceTaskTypeGlobalParameters({
      actorUserId: 2,
      id: 9,
      baseMinutes: 80,
      factor: 1.25,
      scope: 'CLIENT',
      clientId: 10,
    });

    expect(mocks.setCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: 'CLIENT',
          clientId: 10,
          projectId: null,
        }),
      })
    );
    expect(row).toMatchObject({
      revisedScope: 'CLIENT',
      revisedClientId: 10,
      revisedProjectId: null,
    });
  });
});
