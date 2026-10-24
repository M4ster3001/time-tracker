import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import type { Request, Response } from 'express';
import * as userService from '../services/user.service.js';

vi.mock('../services/user.service.js', () => ({
  canViewerAccessUserClients: vi.fn(),
  getUserClients: vi.fn(),
}));

let getUserClientsController: typeof import('./user.controller.js').getUserClientsController;

const createRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('UserController', () => {
  beforeAll(async () => {
    ({ getUserClientsController } = await import('./user.controller.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('deve retornar clientes do usuario autenticado', async () => {
    const req = {
      params: { id: '1' },
      query: {},
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(userService.canViewerAccessUserClients).mockResolvedValueOnce(true);
    vi.mocked(userService.getUserClients).mockResolvedValueOnce([] as any);

    await getUserClientsController(req, res);

    expect(userService.canViewerAccessUserClients).toHaveBeenCalledWith(req.user, 1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deve bloquear acesso de outro usuario', async () => {
    const req = {
      params: { id: '2' },
      query: {},
      user: { userId: 1, roleId: 3, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(userService.canViewerAccessUserClients).mockResolvedValueOnce(false);
    vi.mocked(userService.getUserClients).mockResolvedValueOnce([] as any);

    await getUserClientsController(req, res);

    expect(userService.canViewerAccessUserClients).toHaveBeenCalledWith(req.user, 2);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
