import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import * as adminClientService from './client.service.js';

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    client: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    userClient: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe('AdminClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('deve listar clientes', async () => {
    vi.mocked(prisma.client.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.client.findMany).mockResolvedValueOnce([] as any);
    const result = await adminClientService.listClients({ search: 'Empresa' });
    expect(result.data).toEqual([]);
    expect(result.pagination).toBeDefined();
  });

  it('deve listar clientes sem filtro', async () => {
    vi.mocked(prisma.client.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.client.findMany).mockResolvedValueOnce([] as any);
    await adminClientService.listClients({});
    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 50,
    });
  });

  it('deve listar clientes incluindo inativos', async () => {
    vi.mocked(prisma.client.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.client.findMany).mockResolvedValueOnce([] as any);
    await adminClientService.listClients({ includeInactive: true });
    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 50,
    });
  });

  it('deve filtrar clientes inativos quando isActive=false', async () => {
    vi.mocked(prisma.client.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.client.findMany).mockResolvedValueOnce([] as any);
    await adminClientService.listClients({ includeInactive: true, isActive: false });
    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: { isActive: false, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 50,
    });
  });

  it('deve criar cliente', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.client.create).mockResolvedValueOnce({ id: 1 } as any);
    const result = await adminClientService.createClient({ name: 'Empresa', code: 'EMP' });
    expect(result.id).toBe(1);
  });

  it('nao cria cliente com codigo duplicado', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ id: 1 } as any);

    await expect(adminClientService.createClient({ name: 'Empresa', code: 'EMP' })).rejects.toThrow(
      'Client code already exists'
    );
  });

  it('lista clientes com filtro', async () => {
    vi.mocked(prisma.client.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.client.findMany).mockResolvedValueOnce([{ id: 1, name: 'Cliente A' }] as any);

    const result = await adminClientService.listClients({ search: 'EMP' });

    expect(result.data).toHaveLength(1);
    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [{ name: { contains: 'EMP' } }, { code: { contains: 'EMP' } }],
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 50,
    });
  });

  it('nao permite atualizar com codigo duplicado', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ id: 2 } as any);

    await expect(adminClientService.updateClient(1, { code: 'EMP-A' })).rejects.toThrow(
      'Client code already exists'
    );
  });

  it('deve retornar cliente por id', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ id: 1, name: 'Cliente A' } as any);

    const result = await adminClientService.getClientById(1);

    expect(result?.id).toBe(1);
  });

  it('deve fazer soft delete de cliente', async () => {
    vi.mocked(prisma.client.update).mockResolvedValueOnce({ id: 1 } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

    await adminClientService.deleteClient(1);

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        deletedAt: expect.any(Date),
        deletedBy: null,
        isActive: false,
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('deve listar usuarios do cliente', async () => {
    vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
      { user: { id: 1, name: 'Maria' } },
      { user: { id: 2, name: 'Pedro' } },
    ] as any);

    const result = await adminClientService.getClientUsers(1);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Maria');
  });

  it('permite atualizar com o mesmo codigo do cliente', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ id: 1 } as any);
    vi.mocked(prisma.client.update).mockResolvedValueOnce({ id: 1, code: 'EMP' } as any);

    const result = await adminClientService.updateClient(1, { code: 'EMP', lockDay: null });

    expect(result.id).toBe(1);
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { code: 'EMP', lockDay: null },
    });
  });

  it('PRJ-01 persiste requireProjectOnEntries no update', async () => {
    vi.mocked(prisma.client.update).mockResolvedValueOnce({
      id: 1,
      requireProjectOnEntries: true,
    } as any);

    const result = await adminClientService.updateClient(1, { requireProjectOnEntries: true });

    expect(result.requireProjectOnEntries).toBe(true);
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { requireProjectOnEntries: true },
    });
  });

  it('PRJ-01 persiste requireProjectOnEntries no create', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.client.create).mockResolvedValueOnce({
      id: 2,
      name: 'Novo',
      code: 'NOV',
      requireProjectOnEntries: true,
    } as any);

    const result = await adminClientService.createClient({
      name: 'Novo',
      code: 'NOV',
      requireProjectOnEntries: true,
    });

    expect(result.requireProjectOnEntries).toBe(true);
    expect(prisma.client.create).toHaveBeenCalledWith({
      data: {
        name: 'Novo',
        code: 'NOV',
        lockDay: null,
        paysOvertime: true,
        isActive: true,
        requireProjectOnEntries: true,
      },
    });
  });

  it('remove vinculos ao desativar cliente', async () => {
    vi.mocked(prisma.client.update).mockResolvedValueOnce({ id: 1, isActive: false } as any);

    const result = await adminClientService.updateClient(1, { isActive: false });

    expect(result.id).toBe(1);
    expect(prisma.userClient.deleteMany).toHaveBeenCalledWith({ where: { clientId: 1 } });
  });
});
