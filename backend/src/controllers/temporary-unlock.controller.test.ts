import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  grantTemporaryUnlockController,
  revokeTemporaryUnlockController,
  listTemporaryUnlocksController,
  getTemporaryUnlockDetailsController,
} from './temporary-unlock.controller.js';
import * as temporaryUnlockService from '../services/temporary-unlock.service.js';

vi.mock('../services/temporary-unlock.service.js', () => ({
  grantTemporaryUnlock: vi.fn(),
  revokeTemporaryUnlock: vi.fn(),
  listTemporaryUnlocks: vi.fn(),
  getTemporaryUnlockDetails: vi.fn(),
}));

const createRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('TemporaryUnlockController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('grantTemporaryUnlockController', () => {
    it('deve conceder unlock com dados validos', async () => {
      const req = {
        user: { userId: 1, roleId: 1, email: 'test-user-1@example.test' },
        body: {
          userId: 10,
          clientId: 20,
          periodYear: 2026,
          periodMonth: 1,
          reason: 'Ajuste necessario',
          durationHours: 12,
        },
      } as unknown as Request;
      const res = createRes();

      const mockUnlock = {
        id: 100,
        userId: 10,
        clientId: 20,
        grantedBy: 1,
        periodYear: 2026,
        periodMonth: 1,
        reason: 'Ajuste necessario',
        expiresAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
      };

      vi.mocked(temporaryUnlockService.grantTemporaryUnlock).mockResolvedValue(mockUnlock as any);

      await grantTemporaryUnlockController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUnlock,
      });
      expect(temporaryUnlockService.grantTemporaryUnlock).toHaveBeenCalledWith({
        userId: 10,
        clientId: 20,
        grantedBy: 1,
        periodYear: 2026,
        periodMonth: 1,
        reason: 'Ajuste necessario',
        durationHours: 12,
      });
    });

    it('deve retornar 401 se usuario nao autenticado', async () => {
      const req = {
        user: undefined,
        body: {},
      } as unknown as Request;
      const res = createRes();

      await grantTemporaryUnlockController(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
    });

    it('deve retornar 400 se campos obrigatorios faltando', async () => {
      const req = {
        user: { userId: 1, roleId: 1, email: 'test-user-1@example.test' },
        body: {
          userId: 10,
          // clientId missing
          periodYear: 2026,
          periodMonth: 1,
          reason: 'Test',
        },
      } as unknown as Request;
      const res = createRes();

      await grantTemporaryUnlockController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields',
      });
    });

    it('deve tratar erros do service', async () => {
      const req = {
        user: { userId: 1, roleId: 1, email: 'test-user-1@example.test' },
        body: {
          userId: 10,
          clientId: 20,
          periodYear: 2026,
          periodMonth: 1,
          reason: 'Test',
        },
      } as unknown as Request;
      const res = createRes();

      vi.mocked(temporaryUnlockService.grantTemporaryUnlock).mockRejectedValue(
        new Error('Service error')
      );

      await grantTemporaryUnlockController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
      });
    });
  });

  describe('revokeTemporaryUnlockController', () => {
    it('deve revogar unlock existente', async () => {
      const req = {
        user: { userId: 1, roleId: 1, email: 'test-user-1@example.test' },
        params: { id: '100' },
      } as unknown as Request;
      const res = createRes();

      const mockUnlock = {
        id: 100,
        revokedAt: new Date(),
      };

      vi.mocked(temporaryUnlockService.revokeTemporaryUnlock).mockResolvedValue(mockUnlock as any);

      await revokeTemporaryUnlockController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUnlock,
      });
      expect(temporaryUnlockService.revokeTemporaryUnlock).toHaveBeenCalledWith(100, 1);
    });

    it('deve retornar 401 se usuario nao autenticado', async () => {
      const req = {
        user: undefined,
        params: { id: '100' },
      } as unknown as Request;
      const res = createRes();

      await revokeTemporaryUnlockController(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('deve retornar 400 se id invalido', async () => {
      const req = {
        user: { userId: 1, roleId: 1, email: 'test-user-1@example.test' },
        params: { id: 'abc' },
      } as unknown as Request;
      const res = createRes();

      await revokeTemporaryUnlockController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid id',
      });
    });
  });

  describe('listTemporaryUnlocksController', () => {
    it('deve listar unlocks com filtros', async () => {
      const req = {
        query: {
          userId: '10',
          clientId: '20',
          activeOnly: 'true',
          page: '1',
          limit: '10',
        },
      } as unknown as Request;
      const res = createRes();

      const mockResult = {
        data: [
          {
            id: 100,
            userId: 10,
            clientId: 20,
            userName: 'User',
            clientName: 'Client',
            adminName: 'Admin',
            editCount: 3,
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      vi.mocked(temporaryUnlockService.listTemporaryUnlocks).mockResolvedValue(mockResult as any);

      await listTemporaryUnlocksController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.data,
        pagination: mockResult.pagination,
      });
      expect(temporaryUnlockService.listTemporaryUnlocks).toHaveBeenCalledWith({
        userId: 10,
        clientId: 20,
        activeOnly: true,
        page: 1,
        limit: 10,
      });
    });

    it('deve funcionar sem filtros opcionais', async () => {
      const req = {
        query: {},
      } as unknown as Request;
      const res = createRes();

      const mockResult = {
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      };

      vi.mocked(temporaryUnlockService.listTemporaryUnlocks).mockResolvedValue(mockResult as any);

      await listTemporaryUnlocksController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(temporaryUnlockService.listTemporaryUnlocks).toHaveBeenCalledWith({
        userId: undefined,
        clientId: undefined,
        activeOnly: false,
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('getTemporaryUnlockDetailsController', () => {
    it('deve retornar detalhes de unlock existente', async () => {
      const req = {
        params: { id: '100' },
      } as unknown as Request;
      const res = createRes();

      const mockDetails = {
        id: 100,
        userId: 10,
        clientId: 20,
        userName: 'User',
        clientName: 'Client',
        adminName: 'Admin',
        edits: [
          {
            id: 1,
            action: 'CREATE',
            timeEntryId: 500,
          },
        ],
      };

      vi.mocked(temporaryUnlockService.getTemporaryUnlockDetails).mockResolvedValue(
        mockDetails as any
      );

      await getTemporaryUnlockDetailsController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockDetails,
      });
    });

    it('deve retornar 404 se unlock nao existe', async () => {
      const req = {
        params: { id: '999' },
      } as unknown as Request;
      const res = createRes();

      vi.mocked(temporaryUnlockService.getTemporaryUnlockDetails).mockResolvedValue(null);

      await getTemporaryUnlockDetailsController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not found',
      });
    });

    it('deve retornar 400 se id invalido', async () => {
      const req = {
        params: { id: 'abc' },
      } as unknown as Request;
      const res = createRes();

      await getTemporaryUnlockDetailsController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid id',
      });
    });
  });
});
