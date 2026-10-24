import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  createTimeEntryController,
  listTimeEntriesController,
  getTimeEntryController,
  updateTimeEntryController,
  deleteTimeEntryController,
  monthSummaryController,
  bulkTimeEntriesController,
  listSupervisedTimeEntriesController,
} from './controller.js';
import * as timeEntryService from '../../../services/timeentry.service.js';

vi.mock('../../../services/timeentry.service.js', () => ({
  createTimeEntry: vi.fn(),
  getTimeEntriesByMonth: vi.fn(),
  getTimeEntriesByUser: vi.fn(),
  getTimeEntriesByClientAndMonth: vi.fn(),
  getTimeEntryById: vi.fn(),
  updateTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
  getMonthSummary: vi.fn(),
  createBulkTimeEntries: vi.fn(),
  getSupervisedTimeEntries: vi.fn(),
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    estimateRevision: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    client: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const createRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('TimeEntryController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('createTimeEntryController deve criar e retornar 201', async () => {
    const req = {
      body: {
        clientId: 1,
        date: '2024-01-15',
        activityDescription: 'Dev',
        durationMinutes: 120,
      },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;

    const res = createRes();

    vi.mocked(timeEntryService.createTimeEntry).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      clientId: 1,
      date: new Date('2024-01-15'),
      activityDescription: 'Dev',
      durationMinutes: 120,
      source: 'PORTAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await createTimeEntryController(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('createTimeEntryController usa source PORTAL quando autenticado por JWT', async () => {
    const req = {
      body: { clientId: 1, date: '2024-01-15', activityDescription: 'Dev', durationMinutes: 120 },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
      authTokenType: 'jwt',
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.createTimeEntry).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      clientId: 1,
      date: new Date('2024-01-15'),
      activityDescription: 'Dev',
      durationMinutes: 120,
      source: 'PORTAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await createTimeEntryController(req, res);

    expect(timeEntryService.createTimeEntry).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'PORTAL' })
    );
  });

  it('createTimeEntryController usa source API quando autenticado por token de acesso pessoal', async () => {
    const req = {
      body: { clientId: 1, date: '2024-01-15', activityDescription: 'Dev', durationMinutes: 120 },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
      authTokenType: 'pat',
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.createTimeEntry).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      clientId: 1,
      date: new Date('2024-01-15'),
      activityDescription: 'Dev',
      durationMinutes: 120,
      source: 'API',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await createTimeEntryController(req, res);

    expect(timeEntryService.createTimeEntry).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'API' })
    );
  });

  it('listTimeEntriesController deve filtrar por mês e cliente', async () => {
    const req = {
      query: { month: '1', year: '2024', clientId: '2' },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.getTimeEntriesByClientAndMonth).mockResolvedValueOnce([]);

    await listTimeEntriesController(req, res);

    expect(timeEntryService.getTimeEntriesByClientAndMonth).toHaveBeenCalledWith(1, 2, 2024, 1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('listTimeEntriesController rejeita lista sem year/month', async () => {
    const req = {
      query: {},
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    await listTimeEntriesController(req, res);

    expect(timeEntryService.getTimeEntriesByUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('getTimeEntryController deve retornar lançamento', async () => {
    const req = {
      params: { id: '10' },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.getTimeEntryById).mockResolvedValueOnce({
      id: 10,
      userId: 1,
      clientId: 1,
      date: new Date('2024-01-15'),
      activityDescription: 'Dev',
      durationMinutes: 120,
      source: 'PORTAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await getTimeEntryController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('monthSummaryController deve retornar resumo', async () => {
    const req = {
      query: { month: '1', year: '2024' },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.getMonthSummary).mockResolvedValueOnce({
      totalMinutes: 600,
      totalHours: 10,
      byClient: [],
    });

    await monthSummaryController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('bulkTimeEntriesController deve criar em lote', async () => {
    const req = {
      body: {
        entries: [
          { clientId: 1, date: '2024-01-15', activityDescription: 'Dev', durationMinutes: 120 },
        ],
      },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.createBulkTimeEntries).mockResolvedValueOnce([]);

    await bulkTimeEntriesController(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('bulkTimeEntriesController repassa source API quando autenticado por token de acesso pessoal', async () => {
    const req = {
      body: {
        entries: [
          { clientId: 1, date: '2024-01-15', activityDescription: 'Dev', durationMinutes: 120 },
        ],
      },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
      authTokenType: 'pat',
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.createBulkTimeEntries).mockResolvedValueOnce([]);

    await bulkTimeEntriesController(req, res);

    expect(timeEntryService.createBulkTimeEntries).toHaveBeenCalledWith(
      1,
      expect.any(Array),
      'API'
    );
  });

  // CODE-02/TEST-02: Bulk operation limit tests
  it('bulkTimeEntriesController deve rejeitar mais de 100 entradas', async () => {
    const entries = Array.from({ length: 101 }, (_, i) => ({
      clientId: 1,
      date: '2024-01-15',
      activityDescription: `Entry ${i}`,
      durationMinutes: 60,
    }));

    const req = {
      body: { entries },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    await bulkTimeEntriesController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Maximum 100 entries allowed per bulk operation',
      })
    );
    expect(timeEntryService.createBulkTimeEntries).not.toHaveBeenCalled();
  });

  it('bulkTimeEntriesController deve aceitar exatamente 100 entradas', async () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({
      clientId: 1,
      date: '2024-01-15',
      activityDescription: `Entry ${i}`,
      durationMinutes: 60,
    }));

    const req = {
      body: { entries },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.createBulkTimeEntries).mockResolvedValueOnce([]);

    await bulkTimeEntriesController(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(timeEntryService.createBulkTimeEntries).toHaveBeenCalled();
  });

  it('bulkTimeEntriesController deve rejeitar array vazio', async () => {
    const req = {
      body: { entries: [] },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    await bulkTimeEntriesController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Entries are required',
      })
    );
  });

  it('updateTimeEntryController deve atualizar lançamento', async () => {
    const req = {
      params: { id: '10' },
      body: { durationMinutes: 180 },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.getTimeEntryById).mockResolvedValueOnce({
      id: 10,
      userId: 1,
      clientId: 1,
      date: new Date('2024-01-15'),
      activityDescription: 'Dev',
      durationMinutes: 120,
      source: 'PORTAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(timeEntryService.updateTimeEntry).mockResolvedValueOnce({
      id: 10,
      userId: 1,
      clientId: 1,
      date: new Date('2024-01-15'),
      activityDescription: 'Dev',
      durationMinutes: 180,
      source: 'PORTAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await updateTimeEntryController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deleteTimeEntryController deve deletar lançamento', async () => {
    const req = {
      params: { id: '10' },
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.deleteTimeEntry).mockResolvedValueOnce();

    await deleteTimeEntryController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('listSupervisedTimeEntriesController deve listar para manager/admin', async () => {
    const req = {
      query: { page: '1', limit: '10' },
      user: { userId: 2, roleId: 2, email: 'test-user-2@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(timeEntryService.getSupervisedTimeEntries).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    await listSupervisedTimeEntriesController(req, res);

    expect(timeEntryService.getSupervisedTimeEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 2,
        actorRoleId: 2,
        page: 1,
        limit: 10,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('listSupervisedTimeEntriesController deve bloquear consultor', async () => {
    const req = {
      query: {},
      user: { userId: 7, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    await listSupervisedTimeEntriesController(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(timeEntryService.getSupervisedTimeEntries).not.toHaveBeenCalled();
  });
});
