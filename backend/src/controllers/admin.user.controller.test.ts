import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { listUsersController } from './admin.user.controller.js';
import * as adminUserService from '../services/admin.user.service.js';

vi.mock('../services/admin.user.service.js', () => ({
  listUsers: vi.fn(),
}));

const createRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('AdminUserController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('deve listar usuarios', async () => {
    const req = { query: {} } as unknown as Request;
    const res = createRes();

    vi.mocked(adminUserService.listUsers).mockResolvedValueOnce([] as any);

    await listUsersController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
