import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { authMiddleware, adminMiddleware, managerMiddleware } from './auth.middleware.js';
import { ForbiddenError, UnauthorizedError } from '../../errors/app-error.js';

vi.mock('../../../shared/infrastructure/crypto/jwt.js', () => ({
  extractTokenFromHeader: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('../../../modules/access-tokens/application/access-token.service.js', () => ({
  ACCESS_TOKEN_PREFIX: 'ttpat_',
  verifyAccessToken: vi.fn(),
}));
vi.mock('../../../modules/auth/infrastructure/repositories/prisma-auth-user.repository.js', () => ({
  authUserRepository: { findByIdWithRole: vi.fn() },
}));
import { authUserRepository } from '../../../modules/auth/infrastructure/repositories/prisma-auth-user.repository.js';

import { extractTokenFromHeader, verifyToken } from '../../../shared/infrastructure/crypto/jwt.js';
import { verifyAccessToken } from '../../../modules/access-tokens/application/access-token.service.js';

const createRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar 401 se token ausente', () => {
    const req = { headers: {} } as Request;
    const res = createRes();
    const next = vi.fn();

    vi.mocked(extractTokenFromHeader).mockReturnValue(null);

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deve retornar 401 se token invalido', () => {
    const req = { headers: { authorization: 'Bearer invalid' } } as Request;
    const res = createRes();
    const next = vi.fn();

    vi.mocked(extractTokenFromHeader).mockReturnValue('invalid');
    vi.mocked(verifyToken).mockReturnValue(null);

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deve chamar next e setar req.user com token valido', async () => {
    const payload = { userId: 1, email: 'test-user-1@example.test', roleId: 1 };
    const req = { headers: { authorization: 'Bearer validtoken' } } as Request;
    const res = createRes();
    const next = vi.fn();

    vi.mocked(extractTokenFromHeader).mockReturnValue('validtoken');
    vi.mocked(verifyToken).mockReturnValue(payload);
    vi.mocked(authUserRepository.findByIdWithRole).mockResolvedValue({
      id: 1, email: payload.email, roleId: 1, isActive: true, deletedAt: null,
    } as never);

    await authMiddleware(req, res, next);

    expect(req.user).toEqual(payload);
    expect(req.authTokenType).toBe('jwt');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('usa o papel atual e bloqueia imediatamente conta desativada', async () => {
    const req = { headers: { authorization: 'Bearer old-admin-token' } } as Request;
    const next = vi.fn();
    vi.mocked(extractTokenFromHeader).mockReturnValue('old-admin-token');
    vi.mocked(verifyToken).mockReturnValue({ userId: 1, email: 'test-user-2@example.test', roleId: 1 });
    vi.mocked(authUserRepository.findByIdWithRole).mockResolvedValue({
      id: 1, email: 'test-user-3@example.test', roleId: 3, isActive: true, deletedAt: null,
    } as never);
    await authMiddleware(req, createRes(), next);
    expect(req.user?.roleId).toBe(3);
    vi.mocked(authUserRepository.findByIdWithRole).mockResolvedValue({
      id: 1, isActive: false,
    } as never);
    const disabledReq = { headers: req.headers } as Request;
    await authMiddleware(disabledReq, createRes(), next);
    expect(disabledReq.user).toBeUndefined();
    expect(next).toHaveBeenLastCalledWith(expect.any(UnauthorizedError));
  });

  it('deve chamar next e marcar authTokenType=pat com token de acesso pessoal valido', async () => {
    const payload = { userId: 5, email: 'test-user-4@example.test', roleId: 3 };
    const req = { headers: { authorization: 'Bearer ttpat_abc123' } } as Request;
    const res = createRes();
    const next = vi.fn();

    vi.mocked(extractTokenFromHeader).mockReturnValue('ttpat_abc123');
    vi.mocked(verifyAccessToken).mockResolvedValue(payload);

    await authMiddleware(req, res, next);

    expect(req.user).toEqual(payload);
    expect(req.authTokenType).toBe('pat');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('deve retornar 401 quando o token de acesso pessoal e invalido/revogado/expirado', async () => {
    const req = { headers: { authorization: 'Bearer ttpat_bad' } } as Request;
    const res = createRes();
    const next = vi.fn();

    vi.mocked(extractTokenFromHeader).mockReturnValue('ttpat_bad');
    vi.mocked(verifyAccessToken).mockResolvedValue(null);

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(req.user).toBeUndefined();
  });
});

describe('adminMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve permitir acesso para admin (roleId=1)', () => {
    const req = { user: { userId: 1, email: 'test-user-1@example.test', roleId: 1 } } as unknown as Request;
    const res = createRes();
    const next = vi.fn();

    adminMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deve negar acesso para manager (roleId=2)', () => {
    const req = {
      user: { userId: 2, email: 'test-user-5@example.test', roleId: 2 },
    } as unknown as Request;
    const res = createRes();
    const next = vi.fn();

    adminMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deve negar acesso para consultor (roleId=3)', () => {
    const req = {
      user: { userId: 3, email: 'test-user-6@example.test', roleId: 3 },
    } as unknown as Request;
    const res = createRes();
    const next = vi.fn();

    adminMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deve negar acesso sem usuario autenticado', () => {
    const req = {} as Request;
    const res = createRes();
    const next = vi.fn();

    adminMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('managerMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve permitir acesso para admin (roleId=1)', () => {
    const req = { user: { userId: 1, email: 'test-user-1@example.test', roleId: 1 } } as unknown as Request;
    const res = createRes();
    const next = vi.fn();

    managerMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deve permitir acesso para manager (roleId=2)', () => {
    const req = {
      user: { userId: 2, email: 'test-user-5@example.test', roleId: 2 },
    } as unknown as Request;
    const res = createRes();
    const next = vi.fn();

    managerMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deve negar acesso para consultor (roleId=3)', () => {
    const req = {
      user: { userId: 3, email: 'test-user-6@example.test', roleId: 3 },
    } as unknown as Request;
    const res = createRes();
    const next = vi.fn();

    managerMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deve negar acesso sem usuario autenticado', () => {
    const req = {} as Request;
    const res = createRes();
    const next = vi.fn();

    managerMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(res.status).not.toHaveBeenCalled();
  });
});
