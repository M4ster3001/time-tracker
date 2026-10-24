import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { listClientsController } from './controller.js';
import * as clientService from '../application/client.service.js';

vi.mock('../application/client.service.js', () => ({
  listClients: vi.fn(),
}));

const createRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('AdminClientController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('deve listar clientes', async () => {
    const req = { query: {} } as unknown as Request;
    const res = createRes();

    vi.mocked(clientService.listClients).mockResolvedValueOnce([] as any);

    await listClientsController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
