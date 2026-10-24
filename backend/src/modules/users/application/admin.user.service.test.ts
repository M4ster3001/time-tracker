import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import * as adminUserService from './user.service.js';
import * as passwordCrypto from '../../../shared/infrastructure/crypto/password.js';
import { syncManagerAssignmentHistory } from '../../historical-access/application/historical-access.service.js';

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    userClient: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    seedRun: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../../shared/infrastructure/crypto/password.js', () => ({
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
}));

vi.mock('../../historical-access/application/historical-access.service.js', () => ({
  syncManagerAssignmentHistory: vi.fn(),
}));

describe('AdminUserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (operation: any) => operation(prisma));
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ roleId: 1, accessMode: 'LEGACY', accessMemberships: [] }] as any);
    vi.mocked(syncManagerAssignmentHistory).mockResolvedValue();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // TEST-01: Authorization tests - role hierarchy
  describe('canCreateRole', () => {
    it('Admin (1) can create Admin (1)', () => {
      expect(adminUserService.canCreateRole(1, 1)).toBe(true);
    });

    it('Admin (1) can create Manager (2)', () => {
      expect(adminUserService.canCreateRole(1, 2)).toBe(true);
    });

    it('Admin (1) can create Consultant (3)', () => {
      expect(adminUserService.canCreateRole(1, 3)).toBe(true);
    });

    it('Manager (2) cannot create Admin (1)', () => {
      expect(adminUserService.canCreateRole(2, 1)).toBe(false);
    });

    it('Manager (2) cannot create Manager (2)', () => {
      expect(adminUserService.canCreateRole(2, 2)).toBe(false);
    });

    it('Manager (2) can create Consultant (3)', () => {
      expect(adminUserService.canCreateRole(2, 3)).toBe(true);
    });

    it('Consultant (3) cannot create Admin (1)', () => {
      expect(adminUserService.canCreateRole(3, 1)).toBe(false);
    });

    it('Consultant (3) cannot create Manager (2)', () => {
      expect(adminUserService.canCreateRole(3, 2)).toBe(false);
    });

    it('Consultant (3) cannot create Consultant (3)', () => {
      expect(adminUserService.canCreateRole(3, 3)).toBe(false);
    });
  });

  // CODE-04: Pagination tests
  describe('listUsers with pagination', () => {
    it('deve retornar dados paginados com metadados', async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(25);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 1 }] as any);

      const result = await adminUserService.listUsers({}, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it('deve usar valores padrão quando não especificados', async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(100);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);

      const result = await adminUserService.listUsers({});

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50); // Default
    });

    it('deve limitar máximo de 100 itens por página', async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(500);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);

      const result = await adminUserService.listUsers({}, { page: 1, limit: 200 });

      expect(result.pagination.limit).toBe(100); // Max
    });

    it('deve calcular skip corretamente para página 2', async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(100);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);

      await adminUserService.listUsers({}, { page: 2, limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('deve tratar página negativa como página 1', async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(50);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);

      const result = await adminUserService.listUsers({}, { page: -1, limit: 10 });

      expect(result.pagination.page).toBe(1);
    });

    it('deve filtrar isActive=false quando solicitado', async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);

      await adminUserService.listUsers(
        { includeInactive: true, isActive: false },
        { page: 1, limit: 10 }
      );

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        })
      );
    });
  });

  it('deve listar usuarios com filtros', async () => {
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);
    const result = await adminUserService.listUsers({ roleId: 3, search: 'maria' });
    expect(result.data).toEqual([]);
    expect(prisma.user.findMany).toHaveBeenCalled();
  });

  it('deve listar usuarios sem filtros', async () => {
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);
    await adminUserService.listUsers({});
    // SEC-02: Excludes soft-deleted users by default (deletedAt: null)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, deletedAt: null },
        include: { role: true, manager: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('deve listar usuarios por manager', async () => {
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);
    await adminUserService.listUsers({ managerId: 9 });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { managerId: 9, isActive: true, deletedAt: null },
        include: { role: true, manager: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('deve listar usuarios incluindo inativos', async () => {
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);
    await adminUserService.listUsers({ includeInactive: true });
    // SEC-02: Still excludes soft-deleted unless includeDeleted is true
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        include: { role: true, manager: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('deve criar usuario com senha', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(passwordCrypto.hashPassword).mockResolvedValueOnce('hash');
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ id: 1 } as any);

    const result = await adminUserService.createUser({
      name: 'Maria',
      email: 'test-user-1@example.test',
      password: 'SecurePass123!', // SEC-10: Strong password required
      roleId: 3,
      managerId: 1,
    });

    expect(result.id).toBe(1);
  });

  it('nao cria usuario duplicado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 1 } as any);

    await expect(
      adminUserService.createUser({
        name: 'Maria',
        email: 'test-user-1@example.test',
        password: 'SecurePass123!', // SEC-10: Strong password required
        roleId: 3,
      })
    ).rejects.toThrow('User already exists');
  });

  it('deve vincular cliente ao usuario', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ isActive: true } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: true } as any);
    vi.mocked(prisma.userClient.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.userClient.create).mockResolvedValueOnce({ userId: 1, clientId: 2 } as any);

    await adminUserService.addClientToUser(1, 2);

    expect(prisma.userClient.create).toHaveBeenCalled();
  });

  it('bloqueia vinculo com cliente inativo', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ isActive: false } as any);

    await expect(adminUserService.addClientToUser(1, 2)).rejects.toThrow('Client is inactive');
  });

  it('bloqueia vinculo com usuario inativo', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValueOnce({ isActive: true } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: false } as any);

    await expect(adminUserService.addClientToUser(1, 2)).rejects.toThrow('User is inactive');
  });

  it('bloqueia update com email duplicado', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: 1, roleId: 3, managerId: 5 } as any)
      .mockResolvedValueOnce({ id: 2 } as any);

    await expect(adminUserService.updateUser(1, { email: 'test-user-2@example.test' })).rejects.toThrow(
      'Email already in use'
    );
  });

  it('permite atualizar com mesmo email do usuario', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: 1, roleId: 3, managerId: 5 } as any)
      .mockResolvedValueOnce({ id: 1 } as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: 1 } as any);

    const result = await adminUserService.updateUser(1, { email: 'test-user-3@example.test' });

    expect(result.id).toBe(1);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  // SEC-08: Password change tests
  it('troca senha validando senha antiga (falha)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 1,
      passwordHash: 'hash',
    } as any);
    vi.mocked(passwordCrypto.comparePassword).mockResolvedValueOnce(false);

    // SEC-08: Updated error message
    await expect(
      adminUserService.changeUserPassword(1, 'NewSecurePass123!', 'wrongOld')
    ).rejects.toThrow('Invalid current password');
  });

  it('falha ao trocar senha quando usuario nao existe', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    await expect(
      adminUserService.changeUserPassword(1, 'NewSecurePass123!', 'old')
    ).rejects.toThrow('User not found');
  });

  it('troca senha com senha antiga valida', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 1,
      passwordHash: 'hash',
    } as any);
    vi.mocked(passwordCrypto.comparePassword).mockResolvedValueOnce(true);
    vi.mocked(passwordCrypto.hashPassword).mockResolvedValueOnce('newHash');
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: 1 } as any);

    // SEC-08/SEC-10: Strong password with old password validation
    await adminUserService.changeUserPassword(1, 'NewSecurePass123!', 'oldPass');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { passwordHash: 'newHash' },
    });
  });

  it('troca senha sem senha antiga requer current password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 1,
      passwordHash: 'hash',
    } as any);

    // SEC-08: Now requires old password for self-service
    await expect(adminUserService.changeUserPassword(1, 'NewSecurePass123!')).rejects.toThrow(
      'Current password is required'
    );
  });

  it('admin pode trocar senha sem senha antiga', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 2,
      passwordHash: 'hash',
    } as any);
    vi.mocked(passwordCrypto.hashPassword).mockResolvedValueOnce('newHash');
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: 2 } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

    // SEC-08: Admin can change password without old password (audited)
    await adminUserService.changeUserPassword(2, 'NewSecurePass123!', undefined, {
      isAdminAction: true,
      adminId: 1,
    });

    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('remove cliente do usuario', async () => {
    await adminUserService.removeClientFromUser(1, 2);
    expect(prisma.userClient.deleteMany).toHaveBeenCalled();
  });

  it('lista clientes do usuario', async () => {
    vi.mocked(prisma.userClient.findMany).mockResolvedValueOnce([{ clientId: 1 }] as any);
    const result = await adminUserService.listUserClients(1);
    expect(result).toEqual([1]);
  });

  it('deve retornar usuario por id', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 1, name: 'Maria' } as any);

    const result = await adminUserService.getUserById(1);

    expect(result?.id).toBe(1);
  });

  // SEC-02: Soft delete instead of hard delete
  it('deve fazer soft delete de usuario', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: 1 } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

    await adminUserService.deleteUser(1);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        deletedAt: expect.any(Date),
        deletedBy: null,
        isActive: false,
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
