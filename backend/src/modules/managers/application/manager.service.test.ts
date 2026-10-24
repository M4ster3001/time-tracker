import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  listManagedConsultants,
  listManagerClients,
  updateManagerClientLockDay,
} from './manager.service.js';
import { getManagedConsultantIds } from '../../historical-access/application/historical-access.service.js';

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    timeEntry: {
      groupBy: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    userClient: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../historical-access/application/historical-access.service.js', () => ({
  getManagedConsultantIds: vi.fn(),
}));

describe('ManagerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagedConsultantIds).mockResolvedValue([2]);
  });

  it('lista clientes do manager por periodo', async () => {
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([{ clientId: 1 }] as any);
    vi.mocked(prisma.client.findMany).mockResolvedValueOnce([{ id: 1, name: 'Cliente A' }] as any);

    const result = await listManagerClients(1, 2024, 1);

    expect(result).toHaveLength(1);
    expect(prisma.client.findMany).toHaveBeenCalled();
  });

  it('lista clientes do manager sem periodo', async () => {
    vi.mocked(prisma.userClient.findMany)
      .mockResolvedValueOnce([{ client: { id: 1, name: 'Cliente A' } }] as any)
      .mockResolvedValueOnce([{ client: { id: 2, name: 'Cliente B' } }] as any);

    const result = await listManagerClients(1);

    expect(result).toHaveLength(2);
  });

  it('retorna lista vazia quando nao ha clientes no periodo', async () => {
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([] as any);

    const result = await listManagerClients(1, 2024, 1);

    expect(result).toEqual([]);
  });

  it('lista consultores gerenciados por periodo', async () => {
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([{ userId: 2 }] as any);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 2, name: 'Maria', email: 'test-user-1@example.test' },
    ] as any);

    const result = await listManagedConsultants(1, undefined, 2024, 1);

    expect(result).toHaveLength(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: [2] }, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        managerId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  });

  it('retorna consultores vazios por periodo quando nao ha entradas', async () => {
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([] as any);

    const result = await listManagedConsultants(1, undefined, 2024, 1);

    expect(result).toEqual([]);
  });

  it('lista consultores sem cliente e sem periodo', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 2, name: 'Maria', email: 'test-user-1@example.test' },
    ] as any);

    const result = await listManagedConsultants(1);

    expect(result).toHaveLength(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { managerId: 1, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        managerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('lista consultores por cliente sem periodo', async () => {
    vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
      { user: { id: 2, name: 'Maria' } },
    ] as any);

    const result = await listManagedConsultants(1, 10);

    expect(result).toHaveLength(1);
  });

  it('atualiza lockDay quando manager tem acesso direto', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
      userId: 1,
      clientId: 1,
    } as any);
    vi.mocked(prisma.client.update).mockResolvedValueOnce({ id: 1, lockDay: 5 } as any);

    const result = await updateManagerClientLockDay(1, 1, 5);

    expect(result.lockDay).toBe(5);
    // PERF-04: Now includes select for lazy loading
    expect(prisma.userClient.findUnique).toHaveBeenCalledWith({
      where: { userId_clientId: { userId: 1, clientId: 1 } },
      select: { userId: true },
    });
    expect(prisma.client.update).toHaveBeenCalled();
  });

  it('bloqueia lockDay quando manager nao tem acesso direto', async () => {
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce(null);

    await expect(updateManagerClientLockDay(1, 1, 5)).rejects.toThrow(
      'Manager does not have access to this client'
    );
  });
});
