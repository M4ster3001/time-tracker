import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { csrfOriginMiddleware } from './csrf.middleware.js';
import { ForbiddenError } from '../../errors/app-error.js';

vi.mock('../../../modules/access-tokens/application/access-token.service.js', () => ({
  ACCESS_TOKEN_PREFIX: 'ttpat_',
  verifyAccessToken: vi.fn(),
}));

import { verifyAccessToken } from '../../../modules/access-tokens/application/access-token.service.js';

const buildReq = (overrides: Partial<Request> = {}): Request =>
  ({
    method: 'POST',
    originalUrl: '/api/time-entries',
    headers: {},
    get: vi.fn().mockReturnValue(undefined),
    ...overrides,
  }) as unknown as Request;

const buildRes = (): Response => ({ locals: {} }) as unknown as Response;

describe('csrfOriginMiddleware — isencao por token de acesso pessoal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloqueia quando o token tem o prefixo certo mas nao e valido (nao confia so no prefixo)', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(null);
    const req = buildReq({
      headers: { authorization: 'Bearer ttpat_forjado' },
    } as unknown as Request);
    const res = buildRes();
    const next = vi.fn();

    await csrfOriginMiddleware(req, res, next);

    expect(verifyAccessToken).toHaveBeenCalledWith('ttpat_forjado');
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('libera quando o token com prefixo ttpat_ e realmente valido', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({ userId: 5, email: 'test-user-1@example.test', roleId: 3 });
    const req = buildReq({
      headers: { authorization: 'Bearer ttpat_valido' },
    } as unknown as Request);
    const res = buildRes();
    const next = vi.fn();

    await csrfOriginMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('nao chama verifyAccessToken quando o token nao tem o prefixo de PAT', async () => {
    const req = buildReq({
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.jwt.token' },
    } as unknown as Request);
    const res = buildRes();
    const next = vi.fn();

    await csrfOriginMiddleware(req, res, next);

    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

describe('csrfOriginMiddleware — sync sem isencao por path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloqueia POST /api/sync/push sem Origin, sem x-sync-client e sem PAT valido', async () => {
    const req = buildReq({
      method: 'POST',
      originalUrl: '/api/sync/push',
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Request);
    const res = buildRes();
    const next = vi.fn();

    await csrfOriginMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('libera POST /api/sync/push com header x-sync-client (contrato desktop)', async () => {
    const get = vi.fn((name: string) =>
      name.toLowerCase() === 'x-sync-client' ? 'desktop' : undefined
    );
    const req = buildReq({
      method: 'POST',
      originalUrl: '/api/sync/push',
      get,
    } as unknown as Request);
    const res = buildRes();
    const next = vi.fn();

    await csrfOriginMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
