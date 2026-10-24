import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as timeEntryService from './time-tracking.service.js';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { config } from '../../../config.js';
import {
  canConsultantAccessClientWithHistory,
  getManagedConsultantIds,
} from '../../historical-access/application/historical-access.service.js';
import { recordActivityTag } from '../../../services/activity-tag.service.js';

// Mock do Prisma
vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    userClient: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    timeEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    activityTag: {
      upsert: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    featureSetting: {
      findMany: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    temporaryUnlock: {
      findFirst: vi.fn(),
    },
    temporaryUnlockEdit: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
    closingPeriod: { findFirst: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock('../../historical-access/application/historical-access.service.js', () => ({
  canConsultantAccessClientWithHistory: vi.fn(),
  getManagedConsultantIds: vi.fn(),
}));

vi.mock('../../../services/activity-tag.service.js', () => ({
  recordActivityTag: vi.fn(),
}));

describe('TimeEntryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.closingPeriod.findFirst).mockResolvedValue(null);
    config.timeEntryLockDay = null;
    vi.mocked(prisma.client.findUnique).mockResolvedValue({ lockDay: null } as any);
    vi.mocked(prisma.client.findFirst).mockResolvedValue({
      requireProjectOnEntries: false,
    } as any);
    vi.mocked(prisma.client.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.featureSetting.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
      _sum: { durationMinutes: 0 },
    } as any);
    vi.mocked(prisma.timeEntry.groupBy).mockResolvedValue([] as any);
    vi.mocked(prisma.timeEntry.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.timeEntry.count).mockResolvedValue(0 as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
    vi.mocked(prisma.temporaryUnlock.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.temporaryUnlockEdit.create).mockResolvedValue({} as any);
    vi.mocked(canConsultantAccessClientWithHistory).mockResolvedValue(true);
    vi.mocked(getManagedConsultantIds).mockResolvedValue([5]);
    vi.mocked(recordActivityTag).mockResolvedValue(undefined);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (operation: any) =>
      typeof operation === 'function' ? operation(prisma) : Promise.all(operation)
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createTimeEntry', () => {
    it('deve criar um novo lançamento de horas com sucesso', async () => {
      const data = {
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento de API',
        durationMinutes: 480,
      };

      const createdEntry = {
        id: 1,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
        userId: 1,
        clientId: 1,
        createdAt: new Date(),
      } as any);

      vi.mocked(prisma.timeEntry.create).mockResolvedValueOnce(createdEntry as any);

      const result = await timeEntryService.createTimeEntry(data);

      expect(result.id).toBe(1);
      expect(result.activityDescription).toBe(data.activityDescription);
      expect(result.durationMinutes).toBe(480);
      expect(prisma.userClient.findUnique).toHaveBeenCalled();
      expect(prisma.timeEntry.create).toHaveBeenCalled();
    });

    it('usa source PORTAL por padrao quando nao informado', async () => {
      const data = {
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento de API',
        durationMinutes: 480,
      };

      vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
        userId: 1,
        clientId: 1,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.timeEntry.create).mockResolvedValueOnce({
        id: 1,
        ...data,
        source: 'PORTAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await timeEntryService.createTimeEntry(data);

      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ source: 'PORTAL' }) })
      );
    });

    it('repassa source API quando informado (ex: token de acesso pessoal)', async () => {
      const data = {
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento de API',
        durationMinutes: 480,
        source: 'API' as const,
      };

      vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
        userId: 1,
        clientId: 1,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.timeEntry.create).mockResolvedValueOnce({
        id: 1,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await timeEntryService.createTimeEntry(data);

      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ source: 'API' }) })
      );
    });

    it('deve lançar erro se o usuário não tem acesso ao cliente', async () => {
      const data = {
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento de API',
        durationMinutes: 480,
      };

      vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce(null);

      await expect(timeEntryService.createTimeEntry(data)).rejects.toThrow(
        'User does not have access to this client'
      );
    });

    it('deve lançar erro se a duração é menor que 15 minutos', async () => {
      const data = {
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento de API',
        durationMinutes: 10,
      };

      vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
        userId: 1,
        clientId: 1,
        createdAt: new Date(),
      } as any);

      await expect(timeEntryService.createTimeEntry(data)).rejects.toThrow(
        'Duration must be at least 15 minutes'
      );
    });

    it('deve lançar erro se a duração excede 8 horas por lancamento', async () => {
      const data = {
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento de API',
        durationMinutes: 800,
      };

      vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
        userId: 1,
        clientId: 1,
        createdAt: new Date(),
      } as any);

      await expect(timeEntryService.createTimeEntry(data)).rejects.toThrow(
        'Duration cannot exceed 8 hours per entry'
      );
    });

    it('deve lançar erro se a data é no futuro', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const data = {
        userId: 1,
        clientId: 1,
        date: tomorrow,
        activityDescription: 'Desenvolvimento de API',
        durationMinutes: 480,
      };

      vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
        userId: 1,
        clientId: 1,
        createdAt: new Date(),
      } as any);

      await expect(timeEntryService.createTimeEntry(data)).rejects.toThrow(
        'Cannot create time entry for future dates'
      );
    });

    it('deve lançar erro se o mes estiver fechado', async () => {
      const data = {
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-10'),
        activityDescription: 'Desenvolvimento de API',
        durationMinutes: 480,
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-06'));

      const originalLockDay = config.timeEntryLockDay;
      config.timeEntryLockDay = 5;

      await expect(timeEntryService.createTimeEntry(data)).rejects.toThrow(
        'Time entry month is locked'
      );

      config.timeEntryLockDay = originalLockDay;
      vi.useRealTimers();
    });
  });

  describe('getTimeEntriesByMonth', () => {
    it('deve retornar lançamentos de um mês específico', async () => {
      const entries = [
        {
          id: 1,
          userId: 1,
          clientId: 1,
          date: new Date('2024-01-15'),
          activityDescription: 'Desenvolvimento',
          durationMinutes: 480,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          clientId: 1,
          date: new Date('2024-01-20'),
          activityDescription: 'Testes',
          durationMinutes: 240,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce(entries as any);

      const result = await timeEntryService.getTimeEntriesByMonth(1, 2024, 1);

      expect(result).toHaveLength(2);
      expect(result[0].activityDescription).toBe('Desenvolvimento');
      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 1,
            date: expect.any(Object),
          },
        })
      );
    });

    it('deve retornar array vazio se não há lançamentos no mês', async () => {
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce([]);

      const result = await timeEntryService.getTimeEntriesByMonth(1, 2024, 1);

      expect(result).toHaveLength(0);
    });
  });

  describe('getTimeEntriesByUser', () => {
    it('deve listar lançamentos do usuario', async () => {
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce([
        { id: 1, userId: 1, clientId: 1 } as any,
      ]);

      const result = await timeEntryService.getTimeEntriesByUser(1);

      expect(result).toHaveLength(1);
      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { date: 'desc' },
        take: 500,
      });
    });
  });

  describe('getTimeEntriesByClient', () => {
    it('deve listar lançamentos por cliente', async () => {
      vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
        userId: 1,
        clientId: 2,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce([
        { id: 1, userId: 1, clientId: 2 } as any,
      ]);

      const result = await timeEntryService.getTimeEntriesByClient(1, 2);

      expect(result).toHaveLength(1);
      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith({
        where: { userId: 1, clientId: 2 },
        orderBy: { date: 'desc' },
        take: 500,
      });
    });
  });

  describe('getTotalHoursByClientAndMonth', () => {
    it('deve retornar total de minutos', async () => {
      vi.mocked(prisma.timeEntry.aggregate).mockResolvedValueOnce({
        _sum: { durationMinutes: 120 },
      } as any);

      const result = await timeEntryService.getTotalHoursByClientAndMonth(1, 2, 2024, 1);

      expect(result).toBe(120);
    });
  });

  describe('getTimeEntriesByClientAndMonth', () => {
    it('deve retornar lançamentos filtrados por cliente e mês', async () => {
      const entries = [
        {
          id: 1,
          userId: 1,
          clientId: 2,
          date: new Date('2024-01-10'),
          activityDescription: 'Reunião',
          durationMinutes: 60,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce({
        userId: 1,
        clientId: 2,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce(entries as any);

      const result = await timeEntryService.getTimeEntriesByClientAndMonth(1, 2, 2024, 1);

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe(2);
      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 1, clientId: 2 }),
        })
      );
    });

    it('deve lançar erro se o usuário não tem acesso ao cliente', async () => {
      vi.mocked(canConsultantAccessClientWithHistory).mockResolvedValueOnce(false);

      await expect(timeEntryService.getTimeEntriesByClientAndMonth(1, 2, 2024, 1)).rejects.toThrow(
        'User does not have access to this client'
      );
    });

    it('deve permitir acesso por historico mesmo sem vinculo atual', async () => {
      vi.mocked(canConsultantAccessClientWithHistory).mockResolvedValueOnce(true);
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce([] as any);

      const result = await timeEntryService.getTimeEntriesByClientAndMonth(1, 2, 2024, 1);

      expect(result).toEqual([]);
      expect(prisma.timeEntry.findMany).toHaveBeenCalled();
    });
  });

  describe('getTotalHoursByMonth', () => {
    it('deve retornar o total de minutos do mês', async () => {
      vi.mocked(prisma.timeEntry.aggregate).mockResolvedValueOnce({
        _sum: {
          durationMinutes: 1440, // 24 horas
        },
      } as any);

      const result = await timeEntryService.getTotalHoursByMonth(1, 2024, 1);

      expect(result).toBe(1440);
    });

    it('deve retornar 0 se não há lançamentos', async () => {
      vi.mocked(prisma.timeEntry.aggregate).mockResolvedValueOnce({
        _sum: {
          durationMinutes: null,
        },
      } as any);

      const result = await timeEntryService.getTotalHoursByMonth(1, 2024, 1);

      expect(result).toBe(0);
    });
  });

  describe('getTimeEntryById', () => {
    it('deve retornar o lançamento se pertence ao usuário', async () => {
      const entry = {
        id: 10,
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento',
        durationMinutes: 120,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(entry as any);

      const result = await timeEntryService.getTimeEntryById(10, 1);

      expect(result.id).toBe(10);
    });

    it('deve lançar erro se não encontrado ou não pertence ao usuário', async () => {
      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(null);

      await expect(timeEntryService.getTimeEntryById(10, 1)).rejects.toThrow(
        'Time entry not found or unauthorized'
      );
    });

    it('admin pode acessar entry de qualquer usuario', async () => {
      const entry = {
        id: 10,
        userId: 5,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Dev',
        durationMinutes: 120,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(entry as any);

      const result = await timeEntryService.getTimeEntryById(10, 1, 1);

      expect(result.id).toBe(10);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('manager pode acessar entry de seu consultor', async () => {
      const entry = {
        id: 10,
        userId: 5,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Dev',
        durationMinutes: 120,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(entry as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: 5 } as any);

      const result = await timeEntryService.getTimeEntryById(10, 2, 2);

      expect(result.id).toBe(10);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 5, managerId: 2 },
        select: { id: true },
      });
    });

    it('manager nao pode acessar entry de consultor de outro manager', async () => {
      const entry = {
        id: 10,
        userId: 5,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Dev',
        durationMinutes: 120,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(entry as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      await expect(timeEntryService.getTimeEntryById(10, 2, 2)).rejects.toThrow(
        'Time entry not found or unauthorized'
      );
    });
  });

  describe('updateTimeEntry', () => {
    it('deve atualizar um lançamento de horas com sucesso', async () => {
      const existingEntry = {
        id: 1,
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedEntry = {
        ...existingEntry,
        activityDescription: 'Desenvolvimento (atualizado)',
        durationMinutes: 420,
      };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(existingEntry as any);
      vi.mocked(prisma.timeEntry.update).mockResolvedValueOnce(updatedEntry as any);

      const result = await timeEntryService.updateTimeEntry(1, 1, {
        activityDescription: 'Desenvolvimento (atualizado)',
        durationMinutes: 420,
      });

      expect(result.activityDescription).toBe('Desenvolvimento (atualizado)');
      expect(result.durationMinutes).toBe(420);
    });

    it('deve lançar erro se o lançamento não pertence ao usuário', async () => {
      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(null);

      await expect(
        timeEntryService.updateTimeEntry(1, 1, { durationMinutes: 420 })
      ).rejects.toThrow('Time entry not found or unauthorized');
    });

    it('deve lançar erro se tenta atualizar com duração inválida', async () => {
      const existingEntry = {
        id: 1,
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(existingEntry as any);

      await expect(timeEntryService.updateTimeEntry(1, 1, { durationMinutes: 10 })).rejects.toThrow(
        'Duration must be at least 15 minutes'
      );
    });

    it('deve lançar erro se duração excede 8 horas por lancamento', async () => {
      const existingEntry = {
        id: 1,
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(existingEntry as any);

      await expect(
        timeEntryService.updateTimeEntry(1, 1, { durationMinutes: 800 })
      ).rejects.toThrow('Duration cannot exceed 8 hours per entry');
    });

    it('deve bloquear atualização se mês está fechado', async () => {
      const existingEntry = {
        id: 1,
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-10'),
        activityDescription: 'Desenvolvimento',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-06'));
      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(existingEntry as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ lockDay: 5 } as any);

      await expect(
        timeEntryService.updateTimeEntry(1, 1, { durationMinutes: 120 })
      ).rejects.toThrow('Time entry month is locked');

      vi.useRealTimers();
    });

    it('deve bloquear atualização quando nova data está fechada', async () => {
      const existingEntry = {
        id: 1,
        userId: 1,
        clientId: 1,
        date: new Date('2024-03-10'),
        activityDescription: 'Desenvolvimento',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-06'));
      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(existingEntry as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ lockDay: 5 } as any);

      await expect(
        timeEntryService.updateTimeEntry(1, 1, { date: new Date('2024-02-10') })
      ).rejects.toThrow('Time entry month is locked');

      vi.useRealTimers();
    });

    it('manager pode atualizar entry de seu consultor', async () => {
      const existingEntry = {
        id: 1,
        userId: 5,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Dev',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedEntry = { ...existingEntry, durationMinutes: 240 };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(existingEntry as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: 5 } as any);
      vi.mocked(prisma.timeEntry.update).mockResolvedValueOnce(updatedEntry as any);

      const result = await timeEntryService.updateTimeEntry(1, 2, { durationMinutes: 240 }, 2);

      expect(result.durationMinutes).toBe(240);
    });

    it('manager pode corrigir entry travada de consultor gerenciado mesmo apos fechamento', async () => {
      const existingEntry = {
        id: 1,
        userId: 5,
        clientId: 1,
        date: new Date('2024-01-10'),
        activityDescription: 'Dev',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedEntry = { ...existingEntry, durationMinutes: 240 };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-06'));
      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(existingEntry as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: 5 } as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ lockDay: 5 } as any);
      vi.mocked(prisma.timeEntry.update).mockResolvedValueOnce(updatedEntry as any);

      const result = await timeEntryService.updateTimeEntry(1, 2, { durationMinutes: 240 }, 2);

      expect(result.durationMinutes).toBe(240);
      expect(prisma.temporaryUnlock.findFirst).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('admin pode corrigir entry travada de manager/consultor mesmo apos fechamento', async () => {
      const existingEntry = {
        id: 1,
        userId: 5,
        clientId: 1,
        date: new Date('2024-01-10'),
        activityDescription: 'Dev',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedEntry = { ...existingEntry, durationMinutes: 300 };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-06'));
      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(existingEntry as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ lockDay: 5 } as any);
      vi.mocked(prisma.timeEntry.update).mockResolvedValueOnce(updatedEntry as any);

      const result = await timeEntryService.updateTimeEntry(1, 1, { durationMinutes: 300 }, 1);

      expect(result.durationMinutes).toBe(300);
      expect(prisma.temporaryUnlock.findFirst).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('deleteTimeEntry', () => {
    it('deve deletar um lançamento de horas com sucesso', async () => {
      const existingEntry = {
        id: 1,
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Desenvolvimento',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValue(existingEntry as any);
      vi.mocked(prisma.timeEntry.delete).mockResolvedValue(existingEntry as any);

      await expect(timeEntryService.deleteTimeEntry(1, 1)).resolves.not.toThrow();

      expect(prisma.timeEntry.update).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null, updatedAt: existingEntry.updatedAt },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('deve lançar erro se o lançamento não pertence ao usuário', async () => {
      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValueOnce(null);

      await expect(timeEntryService.deleteTimeEntry(1, 1)).rejects.toThrow(
        'Time entry not found or unauthorized'
      );
    });

    it('manager pode deletar entry de seu consultor', async () => {
      const existingEntry = {
        id: 1,
        userId: 5,
        clientId: 1,
        date: new Date('2024-01-15'),
        activityDescription: 'Dev',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValue(existingEntry as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: 5 } as any);
      vi.mocked(prisma.timeEntry.delete).mockResolvedValue(existingEntry as any);

      await expect(timeEntryService.deleteTimeEntry(1, 2, 2)).resolves.not.toThrow();
      expect(prisma.timeEntry.update).toHaveBeenCalledWith({ where: { id: 1, deletedAt: null, updatedAt: existingEntry.updatedAt }, data: { deletedAt: expect.any(Date) } });
    });

    it('bloqueia exclusao quando mês está fechado', async () => {
      const existingEntry = {
        id: 1,
        userId: 1,
        clientId: 1,
        date: new Date('2024-01-10'),
        activityDescription: 'Desenvolvimento',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-06'));
      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValue(existingEntry as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ lockDay: 5 } as any);

      await expect(timeEntryService.deleteTimeEntry(1, 1)).rejects.toThrow(
        'Time entry month is locked'
      );

      vi.useRealTimers();
    });

    it('manager pode deletar entry travada de consultor gerenciado mesmo apos fechamento', async () => {
      const existingEntry = {
        id: 1,
        userId: 5,
        clientId: 1,
        date: new Date('2024-01-10'),
        activityDescription: 'Dev',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-06'));
      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValue(existingEntry as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: 5 } as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ lockDay: 5 } as any);
      vi.mocked(prisma.timeEntry.delete).mockResolvedValue(existingEntry as any);

      await expect(timeEntryService.deleteTimeEntry(1, 2, 2)).resolves.not.toThrow();
      expect(prisma.temporaryUnlock.findFirst).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('admin pode deletar entry travada de manager/consultor mesmo apos fechamento', async () => {
      const existingEntry = {
        id: 1,
        userId: 5,
        clientId: 1,
        date: new Date('2024-01-10'),
        activityDescription: 'Dev',
        durationMinutes: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-06'));
      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValue(existingEntry as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ lockDay: 5 } as any);
      vi.mocked(prisma.timeEntry.delete).mockResolvedValue(existingEntry as any);

      await expect(timeEntryService.deleteTimeEntry(1, 1, 1)).resolves.not.toThrow();
      expect(prisma.temporaryUnlock.findFirst).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('createBulkTimeEntries', () => {
    it('deve criar lançamentos em lote', async () => {
      const entries = [
        {
          clientId: 1,
          date: new Date('2024-01-15'),
          activityDescription: 'Dev',
          durationMinutes: 120,
        },
        {
          clientId: 2,
          date: new Date('2024-01-16'),
          activityDescription: 'Testes',
          durationMinutes: 60,
        },
      ];

      vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
        { userId: 1, clientId: 1 },
        { userId: 1, clientId: 2 },
      ] as any);

      vi.mocked(prisma.$transaction).mockResolvedValueOnce([
        { id: 1, userId: 1, ...entries[0], createdAt: new Date(), updatedAt: new Date() },
        { id: 2, userId: 1, ...entries[1], createdAt: new Date(), updatedAt: new Date() },
      ] as any);

      const result = await timeEntryService.createBulkTimeEntries(1, entries);

      expect(result).toHaveLength(2);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('usa source PORTAL por padrao quando nao informado', async () => {
      const entries = [
        { clientId: 1, date: new Date('2024-01-15'), activityDescription: 'Dev', durationMinutes: 120 },
      ];

      vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([{ userId: 1, clientId: 1 }] as any);
      vi.mocked(prisma.timeEntry.create).mockResolvedValueOnce({
        id: 1, userId: 1, ...entries[0], source: 'PORTAL', createdAt: new Date(), updatedAt: new Date(),
      } as any);

      await timeEntryService.createBulkTimeEntries(1, entries);

      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ source: 'PORTAL' }) })
      );
    });

    it('repassa source API para todas as entradas do lote quando informado', async () => {
      const entries = [
        { clientId: 1, date: new Date('2024-01-15'), activityDescription: 'Dev', durationMinutes: 120 },
        { clientId: 2, date: new Date('2024-01-16'), activityDescription: 'Testes', durationMinutes: 60 },
      ];

      vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
        { userId: 1, clientId: 1 },
        { userId: 1, clientId: 2 },
      ] as any);
      vi.mocked(prisma.timeEntry.create)
        .mockResolvedValueOnce({ id: 1, userId: 1, ...entries[0], source: 'API' } as any)
        .mockResolvedValueOnce({ id: 2, userId: 1, ...entries[1], source: 'API' } as any);

      await timeEntryService.createBulkTimeEntries(1, entries, 'API');

      expect(prisma.timeEntry.create).toHaveBeenCalledTimes(2);
      expect(prisma.timeEntry.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ data: expect.objectContaining({ source: 'API' }) })
      );
      expect(prisma.timeEntry.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ data: expect.objectContaining({ source: 'API' }) })
      );
    });

    it('deve lançar erro se algum cliente não é permitido', async () => {
      const entries = [
        {
          clientId: 99,
          date: new Date('2024-01-15'),
          activityDescription: 'Dev',
          durationMinutes: 120,
        },
      ];

      vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([] as any);

      await expect(timeEntryService.createBulkTimeEntries(1, entries)).rejects.toThrow(
        'User does not have access to one or more clients'
      );
    });

    it('deve lançar erro se alguma duração é inválida', async () => {
      const entries = [
        {
          clientId: 1,
          date: new Date('2024-01-15'),
          activityDescription: 'Dev',
          durationMinutes: 10,
        },
      ];

      vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
        { userId: 1, clientId: 1 },
      ] as any);

      await expect(timeEntryService.createBulkTimeEntries(1, entries)).rejects.toThrow(
        'Duration must be at least 15 minutes'
      );
    });

    it('deve lançar erro se alguma duração excede 8 horas por lancamento', async () => {
      const entries = [
        {
          clientId: 1,
          date: new Date('2024-01-15'),
          activityDescription: 'Dev',
          durationMinutes: 800,
        },
      ];

      vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
        { userId: 1, clientId: 1 },
      ] as any);

      await expect(timeEntryService.createBulkTimeEntries(1, entries)).rejects.toThrow(
        'Duration cannot exceed 8 hours per entry'
      );
    });

    it('deve lançar erro se data futura', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 1);
      const entries = [
        {
          clientId: 1,
          date: future,
          activityDescription: 'Dev',
          durationMinutes: 120,
        },
      ];

      vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
        { userId: 1, clientId: 1 },
      ] as any);

      await expect(timeEntryService.createBulkTimeEntries(1, entries)).rejects.toThrow(
        'Cannot create time entry for future dates'
      );
    });

    it('deve bloquear entradas quando mês está fechado', async () => {
      const entries = [
        {
          clientId: 1,
          date: new Date('2024-01-10'),
          activityDescription: 'Dev',
          durationMinutes: 120,
        },
      ];

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-06'));
      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([{ id: 1, lockDay: 5 }] as any);
      vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
        { userId: 1, clientId: 1 },
      ] as any);

      await expect(timeEntryService.createBulkTimeEntries(1, entries)).rejects.toThrow(
        'Time entry month is locked'
      );

      vi.useRealTimers();
    });

    it('PRJ-01 rejeita lote sem projeto quando cliente exige requireProjectOnEntries', async () => {
      const entries = [
        {
          clientId: 1,
          date: new Date('2024-01-15'),
          activityDescription: 'Dev',
          durationMinutes: 120,
          projectId: null,
        },
      ];

      vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
        { userId: 1, clientId: 1 },
      ] as any);
      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([
        { id: 1, lockDay: null, requireProjectOnEntries: true },
      ] as any);
      vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
        requireProjectOnEntries: true,
      } as any);

      await expect(timeEntryService.createBulkTimeEntries(1, entries)).rejects.toThrow(
        'PROJECT_REQUIRED'
      );
      expect(prisma.timeEntry.create).not.toHaveBeenCalled();
    });

    it('PRJ-01 persiste projectId no lote quando informado', async () => {
      const entries = [
        {
          clientId: 1,
          date: new Date('2024-01-15'),
          activityDescription: 'Dev',
          durationMinutes: 120,
          projectId: 9,
        },
      ];

      vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([
        { userId: 1, clientId: 1 },
      ] as any);
      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([
        { id: 1, lockDay: null, requireProjectOnEntries: true },
      ] as any);
      vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
        requireProjectOnEntries: true,
      } as any);
      vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
        clientId: 1,
        state: 'ACTIVE',
      } as any);
      vi.mocked(prisma.timeEntry.create).mockResolvedValueOnce({
        id: 1,
        userId: 1,
        ...entries[0],
        source: 'PORTAL',
      } as any);

      await timeEntryService.createBulkTimeEntries(1, entries);

      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ projectId: 9 }),
        })
      );
    });
  });

  describe('getMonthSummary', () => {
    it('deve retornar resumo do mês com total e por cliente', async () => {
      vi.mocked(prisma.timeEntry.aggregate).mockResolvedValueOnce({
        _sum: { durationMinutes: 600 },
      } as any);

      vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([
        { clientId: 1, _sum: { durationMinutes: 360 } },
        { clientId: 2, _sum: { durationMinutes: 240 } },
      ] as any);

      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([
        { id: 1, name: 'Cliente A', paysOvertime: true },
        { id: 2, name: 'Cliente B', paysOvertime: false },
      ] as any);

      const result = await timeEntryService.getMonthSummary(1, 2024, 1);

      expect(result.totalMinutes).toBe(600);
      expect(result.totalHours).toBe(10);
      expect(result.byClient).toHaveLength(2);
      expect(result.byClient[0].clientName).toBe('Cliente A');
    });

    it('deve retornar resumo vazio quando nao ha clientes', async () => {
      vi.mocked(prisma.timeEntry.aggregate).mockResolvedValueOnce({
        _sum: { durationMinutes: null },
      } as any);
      vi.mocked(prisma.timeEntry.groupBy).mockResolvedValueOnce([] as any);

      const result = await timeEntryService.getMonthSummary(1, 2024, 1);

      expect(result.totalMinutes).toBe(0);
      expect(result.byClient).toEqual([]);
    });
  });

  describe('getTimeEntriesByManagedConsultants', () => {
    it('deve retornar lançamentos de consultores gerenciados', async () => {
      const consultants = [
        { id: 2, name: 'Maria', email: 'test-user-1@example.test' },
        { id: 3, name: 'Pedro', email: 'test-user-2@example.test' },
      ];

      const mariaEntries = [
        {
          id: 1,
          userId: 2,
          clientId: 1,
          date: new Date('2024-01-15'),
          activityDescription: 'Desenvolvimento',
          durationMinutes: 480,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const pedroEntries = [
        {
          id: 2,
          userId: 3,
          clientId: 1,
          date: new Date('2024-01-16'),
          activityDescription: 'Testes',
          durationMinutes: 240,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce(consultants as any);
      vi.mocked(prisma.timeEntry.findMany)
        .mockResolvedValueOnce(mariaEntries as any)
        .mockResolvedValueOnce(pedroEntries as any);

      const result = await timeEntryService.getTimeEntriesByManagedConsultants(1, 2024, 1);

      expect(result).toHaveLength(2);
      expect(result[0].consultant.name).toBe('Maria');
      expect(result[0].timeEntries).toHaveLength(1);
      expect(result[1].consultant.name).toBe('Pedro');
      expect(result[1].timeEntries).toHaveLength(1);
    });
  });

  describe('getSupervisedTimeEntries', () => {
    it('manager deve listar apenas consultores gerenciados', async () => {
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{ id: 10 }] as any)
        .mockResolvedValueOnce([{ total: 1 }] as any);
      vi.mocked(prisma.timeEntry.findMany).mockResolvedValueOnce([
        {
          id: 10,
          userId: 5,
          clientId: 7,
          date: new Date('2026-02-10T00:00:00.000Z'),
          activityDescription: 'Correcao supervisionada',
          durationMinutes: 120,
          createdAt: new Date('2026-02-10T10:00:00.000Z'),
          updatedAt: new Date('2026-02-10T10:00:00.000Z'),
          user: { id: 5, name: 'Consultor', email: 'test-user-3@example.test', roleId: 3 },
          client: { id: 7, name: 'Cliente X', lockDay: 26 },
        },
      ] as any);
      const result = await timeEntryService.getSupervisedTimeEntries({
        actorUserId: 2,
        actorRoleId: 2,
        page: 1,
        limit: 20,
      });

      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [10] } },
        })
      );
      expect(result.total).toBe(1);
      expect(result.items[0].user.name).toBe('Consultor');
    });

    it('deve negar filtro por usuario fora do escopo do manager', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      await expect(
        timeEntryService.getSupervisedTimeEntries({
          actorUserId: 2,
          actorRoleId: 2,
          userId: 99,
          page: 1,
          limit: 20,
        })
      ).rejects.toThrow('Forbidden');
    });
  });
});
