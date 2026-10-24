import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { listAuditLogsController } from './controller.js';
import * as auditLogService from '../application/audit-log.service.js';

vi.mock('../application/audit-log.service.js', () => ({
  listAuditLogs: vi.fn(),
}));

const createRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('AuditLogController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('deve retornar logs de auditoria', async () => {
    const req = { query: {} } as unknown as Request;
    const res = createRes();

    vi.mocked(auditLogService.listAuditLogs).mockResolvedValueOnce([] as any);

    await listAuditLogsController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
