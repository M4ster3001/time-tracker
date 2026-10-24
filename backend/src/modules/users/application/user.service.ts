import { comparePassword, hashPassword } from '../../../shared/infrastructure/crypto/password.js';
import { validatePasswordStrength } from '../../../services/auth.service.js';
import { validateAndNormalizeEmail } from '../../../shared/domain/validation/email.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../../app/errors/app-error.js';
import type { IClient } from '../../clients/domain/client.types.js';
import type { IUserWithRole } from '../domain/user.types.js';
import { syncManagerAssignmentHistory } from '../../historical-access/application/historical-access.service.js';
import type { UserRepository } from '../domain/repositories/user.repository.js';
import { userRepository } from '../infrastructure/repositories/prisma-user.repository.js';
import type { PaginatedResult, PaginationParams } from './user.service.interfaces.js';

const defaultRepository = userRepository;

const buildDateRange = (year?: number, month?: number) => {
  if (!year) return null;
  if (month) {
    return {
      gte: new Date(year, month - 1, 1),
      lte: new Date(year, month, 0),
    };
  }
  return {
    gte: new Date(year, 0, 1),
    lte: new Date(year, 11, 31),
  };
};

export const getUserClients = async (
  userId: number,
  year?: number,
  month?: number,
  includeHistorical = true,
  repository: UserRepository = defaultRepository
): Promise<IClient[]> => {
  const currentClientIds = new Set(await repository.listCurrentClientIds(userId));

  if (!includeHistorical) {
    const linkedClients = await repository.listClientsByIds(Array.from(currentClientIds));
    return linkedClients.map((client) => ({ ...client, historicalOnly: false }));
  }

  const range = buildDateRange(year, month);
  if (range) {
    const clientIds = await repository.listHistoricalClientIds(userId, range);
    if (clientIds.length === 0) return [];

    const clients = await repository.listClientsByIds(clientIds);
    return clients.map((client) => ({
      ...client,
      historicalOnly: !currentClientIds.has(client.id),
    }));
  }

  const linkedClients = await repository.listLinkedClients(userId);
  const linkedById = new Map(linkedClients.map((client) => [client.id, client]));
  const historicalClientIds = await repository.listHistoricalClientIds(userId);
  const missingHistoricalClientIds = historicalClientIds.filter(
    (clientId) => !linkedById.has(clientId)
  );

  if (missingHistoricalClientIds.length > 0) {
    const historicalClients = await repository.listClientsByIds(missingHistoricalClientIds);
    historicalClients.forEach((client) => linkedById.set(client.id, client));
  }

  return Array.from(linkedById.values())
    .map((client) => ({
      ...client,
      historicalOnly: !currentClientIds.has(client.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
};

export const canViewerAccessUserClients = async (
  viewer: { userId: number; roleId: number },
  targetUserId: number,
  repository: UserRepository = defaultRepository
): Promise<boolean> => {
  if (viewer.userId === targetUserId || viewer.roleId === 1) return true;
  if (viewer.roleId !== 2) return false;
  return repository.isManagerOfUser(viewer.userId, targetUserId);
};

export const canCreateRole = (callerRoleId: number, targetRoleId: number): boolean => {
  if (callerRoleId === 1) return true;
  if (callerRoleId === 2 && targetRoleId === 3) return true;
  return false;
};

export const listUsers = async (
  filters: {
    roleId?: number;
    search?: string;
    managerId?: number;
    includeInactive?: boolean;
    includeDeleted?: boolean;
    isActive?: boolean;
  },
  pagination?: PaginationParams,
  repository: UserRepository = defaultRepository
): Promise<PaginatedResult<IUserWithRole>> => {
  const where: Record<string, unknown> = {};
  if (filters.roleId) where.roleId = filters.roleId;
  if (filters.managerId) where.managerId = filters.managerId;
  if (typeof filters.isActive === 'boolean') {
    where.isActive = filters.isActive;
  } else if (!filters.includeInactive) {
    where.isActive = true;
  }
  if (!filters.includeDeleted) where.deletedAt = null;
  if (filters.search) {
    where.OR = [{ name: { contains: filters.search } }, { email: { contains: filters.search } }];
  }

  const page = Math.max(1, pagination?.page ?? 1);
  const limit = Math.min(100, Math.max(1, pagination?.limit ?? 50));
  const skip = (page - 1) * limit;

  const total = await repository.countUsers(where);
  const users = await repository.listUsers({ where, skip, take: limit });

  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const createUser = async (
  data: {
    name: string;
    email: string;
    password: string;
    roleId: number;
    managerId?: number | null;
  },
  repository: UserRepository = defaultRepository
): Promise<IUserWithRole> => {
  const normalizedEmail = validateAndNormalizeEmail(data.email);
  const existing = await repository.findUserByEmail(normalizedEmail);
  if (existing) throw new ConflictError('User already exists');

  const passwordValidation = validatePasswordStrength(data.password);
  if (!passwordValidation.isValid) {
    throw new BadRequestError(passwordValidation.errors.join('. '));
  }

  const user = await repository.createUser({
    name: data.name,
    email: normalizedEmail,
    passwordHash: await hashPassword(data.password),
    roleId: data.roleId,
    managerId: data.managerId ?? null,
  });

  if (user.roleId === 3 && user.managerId) {
    await syncManagerAssignmentHistory({
      consultantId: user.id,
      previousManagerId: null,
      nextManagerId: user.managerId,
      effectiveDate: user.createdAt,
    });
  }

  return user;
};

export const getUserById = async (
  id: number,
  repository: UserRepository = defaultRepository
): Promise<IUserWithRole | null> => repository.findUserById(id);

export const updateUser = async (
  id: number,
  data: {
    name?: string;
    email?: string;
    roleId?: number;
    managerId?: number | null;
    isActive?: boolean;
  },
  options?: { actorUserId?: number },
  repository: UserRepository = defaultRepository
): Promise<IUserWithRole> => {
  const existingUser = await repository.findUserForUpdate(id);
  if (!existingUser) throw new NotFoundError('User not found');

  let normalizedEmail: string | undefined;
  if (data.email) {
    normalizedEmail = validateAndNormalizeEmail(data.email);
    const existing = await repository.findUserByEmail(normalizedEmail);
    if (existing && existing.id !== id) throw new ConflictError('Email already in use');
  }

  const user = await repository.updateUser(id, {
    ...(data.name ? { name: data.name } : {}),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    ...(data.roleId ? { roleId: data.roleId } : {}),
    ...(data.managerId !== undefined ? { managerId: data.managerId } : {}),
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
  });

  if (existingUser.roleId === 3 && data.managerId !== undefined) {
    await syncManagerAssignmentHistory({
      consultantId: id,
      previousManagerId: existingUser.managerId,
      nextManagerId: data.managerId,
      effectiveDate: new Date(),
    });
  }

  if (data.isActive !== undefined && options?.actorUserId) {
    await repository.createAuditLog({
      userId: options.actorUserId,
      endpoint: `/api/users/${id}`,
      action: data.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      status: 'success',
      details: `isActive=${data.isActive}`,
    });
  }

  return user;
};

export const deleteUser = async (
  id: number,
  deletedBy?: number,
  repository: UserRepository = defaultRepository
): Promise<void> => {
  await repository.softDeleteUser(id, deletedBy);
  await repository.createAuditLog({
    userId: deletedBy ?? null,
    endpoint: `/api/users/${id}`,
    action: 'USER_SOFT_DELETE',
    status: 'success',
    details: `User ${id} soft deleted by ${deletedBy ?? 'system'}`,
  });
};

export const restoreUser = async (
  id: number,
  restoredBy?: number,
  repository: UserRepository = defaultRepository
): Promise<IUserWithRole> => {
  const user = await repository.restoreUser(id, restoredBy);
  await repository.createAuditLog({
    userId: restoredBy ?? null,
    endpoint: `/api/users/${id}/restore`,
    action: 'USER_RESTORE',
    status: 'success',
    details: `User ${id} restored by ${restoredBy ?? 'system'}`,
  });
  return user;
};

export const permanentlyDeleteUser = async (
  id: number,
  repository: UserRepository = defaultRepository
): Promise<void> => {
  const user = await repository.findUserPasswordData(id);
  if (!user?.deletedAt) {
    throw new BadRequestError('User must be soft-deleted first before permanent deletion');
  }
  await repository.permanentlyDeleteUser(id);
};

export const changeUserPassword = async (
  id: number,
  newPassword: string,
  oldPassword?: string,
  options?: { isAdminAction?: boolean; adminId?: number },
  repository: UserRepository = defaultRepository
): Promise<void> => {
  const user = await repository.findUserPasswordData(id);
  if (!user) throw new NotFoundError('User not found');

  if (!options?.isAdminAction) {
    if (!oldPassword) throw new BadRequestError('Current password is required');
    const valid = await comparePassword(oldPassword, user.passwordHash);
    if (!valid) throw new BadRequestError('Invalid current password');
  }

  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.isValid) {
    throw new BadRequestError(passwordValidation.errors.join('. '));
  }

  await repository.updatePasswordHash(id, await hashPassword(newPassword));

  if (options?.isAdminAction && options.adminId) {
    await repository.createAuditLog({
      userId: options.adminId,
      endpoint: `/api/users/${id}/change-password`,
      action: 'ADMIN_PASSWORD_CHANGE',
      status: 'success',
      details: `Admin changed password for user ${id}`,
    });
  }
};

export const addClientToUser = async (
  userId: number,
  clientId: number,
  repository: UserRepository = defaultRepository
): Promise<void> => {
  if (!(await repository.findClientActive(clientId)))
    throw new BadRequestError('Client is inactive');
  if (!(await repository.findUserActive(userId))) throw new BadRequestError('User is inactive');
  if (await repository.findUserClientLink(userId, clientId)) return;
  await repository.createUserClientLink(userId, clientId);
};

export const removeClientFromUser = async (
  userId: number,
  clientId: number,
  repository: UserRepository = defaultRepository
): Promise<void> => {
  await repository.deleteUserClientLink(userId, clientId);
};

export const listUserClients = async (
  userId: number,
  repository: UserRepository = defaultRepository
): Promise<number[]> => repository.listUserClientIds(userId);
