import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    client: { findFirst: mocks.findFirst },
    project: {
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

import {
  assertProjectUsableForEntry,
  createProject,
  listProjectsForClient,
  updateProject,
} from './project.service.js';

describe('project.service PRJ-01', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista projetos do cliente', async () => {
    mocks.findMany.mockResolvedValue([{ id: 1, code: 'A' }]);
    await expect(listProjectsForClient(3)).resolves.toEqual([{ id: 1, code: 'A' }]);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: 3 } })
    );
  });

  it('cria projeto com codigo normalizado e rejeita duplicata no mesmo cliente', async () => {
    mocks.findFirst.mockResolvedValue({ id: 3 });
    mocks.create.mockResolvedValue({ id: 9, code: 'API', clientId: 3 });
    await expect(
      createProject({ clientId: 3, code: ' api ', name: 'API' })
    ).resolves.toMatchObject({ code: 'API' });

    mocks.create.mockRejectedValue({ code: 'P2002' });
    await expect(createProject({ clientId: 3, code: 'API', name: 'API' })).rejects.toMatchObject({
      message: 'PROJECT_CODE_DUPLICATE',
    });
  });

  it('permite mesmo codigo em outro cliente (unicidade so por clientId+code)', async () => {
    mocks.findFirst.mockResolvedValue({ id: 4 });
    mocks.create.mockResolvedValue({ id: 10, code: 'API', clientId: 4 });
    await expect(
      createProject({ clientId: 4, code: 'API', name: 'Outro' })
    ).resolves.toMatchObject({ clientId: 4, code: 'API' });
  });

  it('rejeita projeto de cliente errado e estado arquivado', async () => {
    mocks.findUnique.mockResolvedValue({ clientId: 2, state: 'ACTIVE' });
    await expect(
      assertProjectUsableForEntry({ clientId: 1, projectId: 9, requireProject: false })
    ).rejects.toThrow(/PROJECT_CLIENT_MISMATCH/);

    mocks.findUnique.mockResolvedValue({ clientId: 1, state: 'ARCHIVED' });
    await expect(
      assertProjectUsableForEntry({ clientId: 1, projectId: 9, requireProject: false })
    ).rejects.toMatchObject({ message: 'PROJECT_NOT_ACCEPTING_ENTRIES' });
  });

  it('exige projeto quando a politica do cliente pede', async () => {
    await expect(
      assertProjectUsableForEntry({ clientId: 1, projectId: null, requireProject: true })
    ).rejects.toMatchObject({ message: 'PROJECT_REQUIRED' });
  });

  it('atualiza nome e estado sem alterar codigo do cliente', async () => {
    mocks.findUnique.mockResolvedValue({ id: 9, clientId: 3, code: 'API' });
    mocks.update.mockResolvedValue({ id: 9, name: 'Novo', state: 'PAUSED' });
    await expect(
      updateProject(9, { name: ' Novo ', state: 'PAUSED' })
    ).resolves.toMatchObject({ name: 'Novo', state: 'PAUSED' });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { name: 'Novo', state: 'PAUSED' },
    });
  });
});
