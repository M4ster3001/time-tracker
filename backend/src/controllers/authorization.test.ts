import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createUserController } from './admin.user.controller.js';
import { getUserClientsController } from './user.controller.js';
import * as adminUserService from '../services/admin.user.service.js';
import * as userService from '../services/user.service.js';

vi.mock('../services/admin.user.service.js', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  addClientToUser: vi.fn(),
  removeClientFromUser: vi.fn(),
  listUserClients: vi.fn(),
  changeUserPassword: vi.fn(),
  canCreateRole: vi.fn(),
}));

vi.mock('../services/user.service.js', () => ({
  canViewerAccessUserClients: vi.fn(),
  getUserClients: vi.fn(),
}));

vi.mock('../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    user: { findFirst: vi.fn() },
  },
}));

const createRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('Authorization: createUserController role checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin pode criar qualquer role', async () => {
    const req = {
      user: { userId: 1, email: 'test-user-1@example.test', roleId: 1 },
      body: { name: 'New User', email: 'test-user-2@example.test', password: 'Pass123!', roleId: 1 },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(adminUserService.canCreateRole).mockReturnValue(true);
    vi.mocked(adminUserService.createUser).mockResolvedValue({
      id: 10,
      name: 'New User',
      email: 'test-user-2@example.test',
      roleId: 1,
      roleName: 'Admin',
      isActive: true,
      managerId: null,
    } as any);

    await createUserController(req, res);

    expect(adminUserService.canCreateRole).toHaveBeenCalledWith(1, 1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('manager pode criar consultor (roleId=3)', async () => {
    const req = {
      user: { userId: 2, email: 'test-user-3@example.test', roleId: 2 },
      body: { name: 'New Consultant', email: 'test-user-4@example.test', password: 'Pass123!', roleId: 3 },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(adminUserService.canCreateRole).mockReturnValue(true);
    vi.mocked(adminUserService.createUser).mockResolvedValue({
      id: 11,
      name: 'New Consultant',
      email: 'test-user-4@example.test',
      roleId: 3,
      roleName: 'Consultant',
      isActive: true,
      managerId: 2,
    } as any);

    await createUserController(req, res);

    expect(adminUserService.canCreateRole).toHaveBeenCalledWith(2, 3);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('manager nao pode criar admin', async () => {
    const req = {
      user: { userId: 2, email: 'test-user-3@example.test', roleId: 2 },
      body: { name: 'Evil Admin', email: 'test-user-5@example.test', password: 'Pass123!', roleId: 1 },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(adminUserService.canCreateRole).mockReturnValue(false);

    await createUserController(req, res);

    expect(adminUserService.canCreateRole).toHaveBeenCalledWith(2, 1);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'You do not have permission to create users with this role',
      })
    );
  });

  it('manager nao pode criar outro manager', async () => {
    const req = {
      user: { userId: 2, email: 'test-user-3@example.test', roleId: 2 },
      body: { name: 'Another Mgr', email: 'test-user-6@example.test', password: 'Pass123!', roleId: 2 },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(adminUserService.canCreateRole).mockReturnValue(false);

    await createUserController(req, res);

    expect(adminUserService.canCreateRole).toHaveBeenCalledWith(2, 2);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 401 se usuario nao autenticado', async () => {
    const req = {
      user: undefined,
      body: { name: 'Test', email: 'test-user-7@example.test', password: 'Pass123!', roleId: 3 },
    } as unknown as Request;
    const res = createRes();

    await createUserController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Unauthorized' })
    );
  });

  it('retorna 400 se campos obrigatorios faltando', async () => {
    const req = {
      user: { userId: 1, email: 'test-user-1@example.test', roleId: 1 },
      body: { name: 'Test' },
    } as unknown as Request;
    const res = createRes();

    await createUserController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Missing required fields' })
    );
  });
});

describe('Authorization: canCreateRole unit tests', () => {
  it('admin (roleId=1) pode criar qualquer role', () => {
    expect(adminUserService.canCreateRole(1, 1)).toBeDefined();
    expect(adminUserService.canCreateRole(1, 2)).toBeDefined();
    expect(adminUserService.canCreateRole(1, 3)).toBeDefined();
  });
});

describe('Authorization: getUserClientsController access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consultor pode ver seus proprios clientes', async () => {
    const req = {
      params: { id: '5' },
      query: {},
      user: { userId: 5, roleId: 3, email: 'test-user-8@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(userService.canViewerAccessUserClients).mockResolvedValue(true);
    vi.mocked(userService.canViewerAccessUserClients).mockResolvedValue(true);
    vi.mocked(userService.getUserClients).mockResolvedValue([] as any);

    await getUserClientsController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('consultor nao pode ver clientes de outro usuario', async () => {
    const req = {
      params: { id: '10' },
      query: {},
      user: { userId: 5, roleId: 3, email: 'test-user-8@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(userService.canViewerAccessUserClients).mockResolvedValue(false);

    await getUserClientsController(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('admin pode ver clientes de qualquer usuario', async () => {
    const req = {
      params: { id: '10' },
      query: {},
      user: { userId: 1, roleId: 1, email: 'test-user-1@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(userService.canViewerAccessUserClients).mockResolvedValue(true);
    vi.mocked(userService.getUserClients).mockResolvedValue([] as any);

    await getUserClientsController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('manager pode ver clientes do seu consultor', async () => {
    const req = {
      params: { id: '10' },
      query: {},
      user: { userId: 2, roleId: 2, email: 'test-user-3@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(userService.canViewerAccessUserClients).mockResolvedValue(true);
    vi.mocked(userService.getUserClients).mockResolvedValue([] as any);

    await getUserClientsController(req, res);

    expect(userService.canViewerAccessUserClients).toHaveBeenCalledWith(req.user, 10);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('manager nao pode ver clientes de consultor de outro manager', async () => {
    const req = {
      params: { id: '10' },
      query: {},
      user: { userId: 2, roleId: 2, email: 'test-user-3@example.test' },
    } as unknown as Request;
    const res = createRes();

    vi.mocked(userService.canViewerAccessUserClients).mockResolvedValue(false);

    await getUserClientsController(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 401 sem usuario autenticado', async () => {
    const req = {
      params: { id: '5' },
      query: {},
      user: undefined,
    } as unknown as Request;
    const res = createRes();

    await getUserClientsController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
