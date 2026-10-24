import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as userService from './user.service.js';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    userClient: {
      findMany: vi.fn(),
    },
    timeEntry: {
      groupBy: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
    },
  },
}));

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.userClient.findMany).mockResolvedValue([] as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('deve retornar clientes do usuario', async () => {
    vi.mocked(prisma.userClient.findMany)
      .mockResolvedValueOnce([{ clientId: 1 }, { clientId: 2 }] as any)
      .mockResolvedValueOnce([
        {
          client: {
            id: 1,
            name: 'Cliente A',
            code: 'A',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          client: {
            id: 2,
            name: 'Cliente B',
            code: 'B',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ] as any);
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([] as any);

    const result = await userService.getUserClients(1);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Cliente A');
  });

  it('deve incluir clientes historicos mesmo sem vinculo atual', async () => {
    vi.mocked(prisma.userClient.findMany)
      .mockResolvedValueOnce([{ clientId: 1 }] as any)
      .mockResolvedValueOnce([
        {
          client: {
            id: 1,
            name: 'Cliente Atual',
            code: 'AT',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ] as any);
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([
      { clientId: 1 },
      { clientId: 3 },
    ] as any);
    vi.mocked(prisma.client.findMany).mockResolvedValueOnce([
      {
        id: 3,
        name: 'Cliente Historico',
        code: 'HI',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const result = await userService.getUserClients(1);

    expect(result).toHaveLength(2);
    expect(result.some((item) => item.id === 3)).toBe(true);
  });

  it('retorna clientes por periodo', async () => {
    vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([{ clientId: 1 }] as any);
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([{ clientId: 1 }] as any);
    vi.mocked(prisma.client.findMany).mockResolvedValueOnce([
      { id: 1, name: 'Cliente A', code: 'A', createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    const result = await userService.getUserClients(1, 2024, 1);

    expect(result).toHaveLength(1);
    expect(prisma.timeEntry.groupBy).toHaveBeenCalled();
  });

  it('retorna vazio quando nao ha lancamentos no periodo', async () => {
    vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([] as any);

    const result = await userService.getUserClients(1, 2024, 1);

    expect(result).toHaveLength(0);
  });
});
