import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  grantTemporaryUnlock,
  revokeTemporaryUnlock,
  hasActiveTemporaryUnlock,
  recordTemporaryUnlockEdit,
  listTemporaryUnlocks,
  getTemporaryUnlockDetails,
} from './temporary-unlock.service.js';

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
    },
    userClient: {
      findUnique: vi.fn(),
    },
    temporaryUnlock: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    temporaryUnlockEdit: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../../../shared/infrastructure/db/prisma.js';

describe('TemporaryUnlockService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('grantTemporaryUnlock', () => {
    it('deve conceder unlock temporario com dados validos', async () => {
      const mockData = {
        userId: 1,
        clientId: 2,
        grantedBy: 10,
        periodYear: 2026,
        periodMonth: 1,
        reason: 'Ajuste necessario',
        durationHours: 12,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1, isActive: true } as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValue({ id: 2, isActive: true } as any);
      vi.mocked(prisma.userClient.findUnique).mockResolvedValue({ userId: 1 } as any);
      vi.mocked(prisma.temporaryUnlock.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.temporaryUnlock.create).mockResolvedValue({
        id: 100,
        ...mockData,
        expiresAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await grantTemporaryUnlock(mockData);

      expect(result).toBeDefined();
      expect(result.id).toBe(100);
      expect(prisma.temporaryUnlock.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('deve rejeitar mes invalido', async () => {
      const mockData = {
        userId: 1,
        clientId: 2,
        grantedBy: 10,
        periodYear: 2026,
        periodMonth: 13,
        reason: 'Ajuste',
      };

      await expect(grantTemporaryUnlock(mockData)).rejects.toThrow('Invalid month');
    });

    it('deve rejeitar ano invalido', async () => {
      const mockData = {
        userId: 1,
        clientId: 2,
        grantedBy: 10,
        periodYear: 1999,
        periodMonth: 1,
        reason: 'Ajuste',
      };

      await expect(grantTemporaryUnlock(mockData)).rejects.toThrow('Invalid year');
    });

    it('deve rejeitar reason muito curta', async () => {
      const mockData = {
        userId: 1,
        clientId: 2,
        grantedBy: 10,
        periodYear: 2026,
        periodMonth: 1,
        reason: 'abc',
      };

      await expect(grantTemporaryUnlock(mockData)).rejects.toThrow(
        'Reason must be at least 5 characters'
      );
    });

    it('deve rejeitar usuario inativo', async () => {
      const mockData = {
        userId: 1,
        clientId: 2,
        grantedBy: 10,
        periodYear: 2026,
        periodMonth: 1,
        reason: 'Ajuste necessario',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1, isActive: false } as any);

      await expect(grantTemporaryUnlock(mockData)).rejects.toThrow('User not found or inactive');
    });

    it('deve rejeitar se usuario nao tem acesso ao cliente', async () => {
      const mockData = {
        userId: 1,
        clientId: 2,
        grantedBy: 10,
        periodYear: 2026,
        periodMonth: 1,
        reason: 'Ajuste necessario',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1, isActive: true } as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValue({ id: 2, isActive: true } as any);
      vi.mocked(prisma.userClient.findUnique).mockResolvedValue(null);

      await expect(grantTemporaryUnlock(mockData)).rejects.toThrow(
        'User is not assigned to this client'
      );
    });

    it('deve rejeitar se ja existe unlock ativo para mesmo periodo', async () => {
      const mockData = {
        userId: 1,
        clientId: 2,
        grantedBy: 10,
        periodYear: 2026,
        periodMonth: 1,
        reason: 'Ajuste necessario',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1, isActive: true } as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValue({ id: 2, isActive: true } as any);
      vi.mocked(prisma.userClient.findUnique).mockResolvedValue({ userId: 1 } as any);
      vi.mocked(prisma.temporaryUnlock.findFirst).mockResolvedValue({
        id: 99,
        expiresAt: new Date(Date.now() + 10000),
      } as any);

      await expect(grantTemporaryUnlock(mockData)).rejects.toThrow(
        'An active unlock already exists for this user/client/period'
      );
    });

    it('deve limitar duracao a 24 horas', async () => {
      const mockData = {
        userId: 1,
        clientId: 2,
        grantedBy: 10,
        periodYear: 2026,
        periodMonth: 1,
        reason: 'Ajuste necessario',
        durationHours: 48,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1, isActive: true } as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValue({ id: 2, isActive: true } as any);
      vi.mocked(prisma.userClient.findUnique).mockResolvedValue({ userId: 1 } as any);
      vi.mocked(prisma.temporaryUnlock.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.temporaryUnlock.create).mockResolvedValue({
        id: 100,
        ...mockData,
        expiresAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await grantTemporaryUnlock(mockData);

      const createCall = vi.mocked(prisma.temporaryUnlock.create).mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      const maxDiff = 24 * 60 * 60 * 1000 + 1000; // 24h + 1s tolerance

      expect(diff).toBeLessThanOrEqual(maxDiff);
    });
  });

  describe('revokeTemporaryUnlock', () => {
    it('deve revogar unlock ativo', async () => {
      const unlockId = 100;
      const revokedBy = 10;
      const futureDate = new Date(Date.now() + 10000);

      vi.mocked(prisma.temporaryUnlock.findUnique).mockResolvedValue({
        id: unlockId,
        userId: 1,
        expiresAt: futureDate,
        revokedAt: null,
      } as any);
      vi.mocked(prisma.temporaryUnlock.update).mockResolvedValue({
        id: unlockId,
        revokedAt: new Date(),
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await revokeTemporaryUnlock(unlockId, revokedBy);

      expect(result.id).toBe(unlockId);
      expect(prisma.temporaryUnlock.update).toHaveBeenCalledWith({
        where: { id: unlockId },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('deve rejeitar unlock nao encontrado', async () => {
      vi.mocked(prisma.temporaryUnlock.findUnique).mockResolvedValue(null);

      await expect(revokeTemporaryUnlock(999, 10)).rejects.toThrow('Temporary unlock not found');
    });

    it('deve rejeitar unlock ja revogado', async () => {
      vi.mocked(prisma.temporaryUnlock.findUnique).mockResolvedValue({
        id: 100,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
      } as any);

      await expect(revokeTemporaryUnlock(100, 10)).rejects.toThrow(
        'Temporary unlock already revoked'
      );
    });

    it('deve rejeitar unlock ja expirado', async () => {
      const pastDate = new Date(Date.now() - 10000);
      vi.mocked(prisma.temporaryUnlock.findUnique).mockResolvedValue({
        id: 100,
        revokedAt: null,
        expiresAt: pastDate,
      } as any);

      await expect(revokeTemporaryUnlock(100, 10)).rejects.toThrow(
        'Temporary unlock already expired'
      );
    });
  });

  describe('hasActiveTemporaryUnlock', () => {
    it('deve retornar unlock ativo se existe', async () => {
      const userId = 1;
      const clientId = 2;
      const entryDate = new Date('2026-01-15');

      vi.mocked(prisma.temporaryUnlock.findFirst).mockResolvedValue({ id: 100 } as any);

      const result = await hasActiveTemporaryUnlock(userId, clientId, entryDate);

      expect(result).toEqual({ unlockId: 100 });
      expect(prisma.temporaryUnlock.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          clientId,
          periodYear: 2026,
          periodMonth: 1,
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        select: { id: true },
      });
    });

    it('deve retornar null se nao existe unlock ativo', async () => {
      vi.mocked(prisma.temporaryUnlock.findFirst).mockResolvedValue(null);

      const result = await hasActiveTemporaryUnlock(1, 2, new Date());

      expect(result).toBeNull();
    });
  });

  describe('recordTemporaryUnlockEdit', () => {
    it('deve registrar edicao CREATE', async () => {
      const data = {
        temporaryUnlockId: 100,
        timeEntryId: 500,
        action: 'CREATE' as const,
        newData: { duration: 60, description: 'New task' },
      };

      vi.mocked(prisma.temporaryUnlockEdit.create).mockResolvedValue({} as any);

      await recordTemporaryUnlockEdit(data);

      expect(prisma.temporaryUnlockEdit.create).toHaveBeenCalledWith({
        data: {
          temporaryUnlockId: 100,
          timeEntryId: 500,
          action: 'CREATE',
          previousData: undefined,
          newData: expect.any(Object),
        },
      });
    });

    it('deve registrar edicao UPDATE com before/after', async () => {
      const data = {
        temporaryUnlockId: 100,
        timeEntryId: 500,
        action: 'UPDATE' as const,
        previousData: { duration: 60 },
        newData: { duration: 90 },
      };

      vi.mocked(prisma.temporaryUnlockEdit.create).mockResolvedValue({} as any);

      await recordTemporaryUnlockEdit(data);

      expect(prisma.temporaryUnlockEdit.create).toHaveBeenCalled();
    });

    it('deve registrar edicao DELETE', async () => {
      const data = {
        temporaryUnlockId: 100,
        timeEntryId: 500,
        action: 'DELETE' as const,
        previousData: { duration: 60, description: 'Deleted task' },
      };

      vi.mocked(prisma.temporaryUnlockEdit.create).mockResolvedValue({} as any);

      await recordTemporaryUnlockEdit(data);

      expect(prisma.temporaryUnlockEdit.create).toHaveBeenCalled();
    });
  });

  describe('listTemporaryUnlocks', () => {
    it('deve listar todos os unlocks com paginacao', async () => {
      vi.mocked(prisma.temporaryUnlock.count).mockResolvedValue(5);
      vi.mocked(prisma.temporaryUnlock.findMany).mockResolvedValue([
        {
          id: 1,
          userId: 10,
          clientId: 20,
          grantedBy: 1,
          periodYear: 2026,
          periodMonth: 1,
          reason: 'Test',
          expiresAt: new Date(),
          revokedAt: null,
          createdAt: new Date(),
          user: { name: 'User Name' },
          client: { name: 'Client Name' },
          admin: { name: 'Admin Name' },
          _count: { edits: 3 },
        },
      ] as any);

      const result = await listTemporaryUnlocks({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].editCount).toBe(3);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.page).toBe(1);
    });

    it('deve filtrar por activeOnly', async () => {
      vi.mocked(prisma.temporaryUnlock.count).mockResolvedValue(0);
      vi.mocked(prisma.temporaryUnlock.findMany).mockResolvedValue([]);

      await listTemporaryUnlocks({ activeOnly: true });

      const countCall = vi.mocked(prisma.temporaryUnlock.count).mock.calls[0]?.[0];
      expect(countCall?.where).toMatchObject({
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      });
    });
  });

  describe('getTemporaryUnlockDetails', () => {
    it('deve retornar detalhes com edits', async () => {
      vi.mocked(prisma.temporaryUnlock.findUnique).mockResolvedValue({
        id: 100,
        userId: 1,
        clientId: 2,
        grantedBy: 10,
        periodYear: 2026,
        periodMonth: 1,
        reason: 'Test',
        expiresAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
        user: { name: 'User' },
        client: { name: 'Client' },
        admin: { name: 'Admin' },
        edits: [
          {
            id: 1,
            temporaryUnlockId: 100,
            timeEntryId: 500,
            action: 'CREATE',
            previousData: null,
            newData: {},
            createdAt: new Date(),
          },
        ],
      } as any);

      const result = await getTemporaryUnlockDetails(100);

      expect(result).toBeDefined();
      expect(result?.id).toBe(100);
      expect(result?.edits).toHaveLength(1);
      expect(result?.userName).toBe('User');
    });

    it('deve retornar null se unlock nao existe', async () => {
      vi.mocked(prisma.temporaryUnlock.findUnique).mockResolvedValue(null);

      const result = await getTemporaryUnlockDetails(999);

      expect(result).toBeNull();
    });
  });
});
