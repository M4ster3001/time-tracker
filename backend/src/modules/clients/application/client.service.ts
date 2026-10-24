import type { IClient } from '../domain/client.types.js';
import type { IUser } from '../../users/domain/user.types.js';
import { BadRequestError, ConflictError } from '../../../app/errors/app-error.js';
import type { ClientRepository } from '../domain/repositories/client.repository.js';
import { clientRepository } from '../infrastructure/repositories/prisma-client.repository.js';
import type { PaginatedResult, PaginationParams } from './client.service.interfaces.js';

const defaultRepository = clientRepository;

export const listClients = async (
  filters: {
    search?: string;
    includeInactive?: boolean;
    includeDeleted?: boolean;
    isActive?: boolean;
  },
  pagination?: PaginationParams,
  repository: ClientRepository = defaultRepository
): Promise<PaginatedResult<IClient>> => {
  const where: Record<string, unknown> = {};

  if (typeof filters.isActive === 'boolean') {
    where.isActive = filters.isActive;
  } else if (!filters.includeInactive) {
    where.isActive = true;
  }
  if (!filters.includeDeleted) where.deletedAt = null;
  if (filters.search) {
    where.OR = [{ name: { contains: filters.search } }, { code: { contains: filters.search } }];
  }

  const page = Math.max(1, pagination?.page ?? 1);
  const limit = Math.min(100, Math.max(1, pagination?.limit ?? 50));
  const skip = (page - 1) * limit;

  const total = await repository.countClients(where);
  const clients = await repository.listClients({ where, skip, take: limit });

  return {
    data: clients,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const createClient = async (
  data: {
    name: string;
    code: string;
    lockDay?: number | null;
    paysOvertime?: boolean;
    requireProjectOnEntries?: boolean;
    isActive?: boolean;
  },
  repository: ClientRepository = defaultRepository
): Promise<IClient> => {
  const existing = await repository.findClientByCode(data.code);
  if (existing) throw new ConflictError('Client code already exists');

  return repository.createClient({
    name: data.name,
    code: data.code,
    lockDay: data.lockDay ?? null,
    paysOvertime: data.paysOvertime ?? true,
    isActive: data.isActive ?? true,
    ...(data.requireProjectOnEntries !== undefined
      ? { requireProjectOnEntries: data.requireProjectOnEntries }
      : {}),
  });
};

export const getClientById = async (
  id: number,
  repository: ClientRepository = defaultRepository
): Promise<IClient | null> => repository.findClientById(id);

export const updateClient = async (
  id: number,
  data: {
    name?: string;
    code?: string;
    lockDay?: number | null;
    paysOvertime?: boolean;
    requireProjectOnEntries?: boolean;
    isActive?: boolean;
  },
  options?: { actorUserId?: number },
  repository: ClientRepository = defaultRepository
): Promise<IClient> => {
  if (data.code) {
    const existing = await repository.findClientByCode(data.code);
    if (existing && existing.id !== id) {
      throw new ConflictError('Client code already exists');
    }
  }

  const client = await repository.updateClient(id, {
    ...(data.name ? { name: data.name } : {}),
    ...(data.code ? { code: data.code } : {}),
    ...(data.lockDay !== undefined ? { lockDay: data.lockDay } : {}),
    ...(data.paysOvertime !== undefined ? { paysOvertime: data.paysOvertime } : {}),
    ...(data.requireProjectOnEntries !== undefined
      ? { requireProjectOnEntries: data.requireProjectOnEntries }
      : {}),
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
  });

  if (data.isActive === false) {
    await repository.removeAllUserLinks(id);
  }

  if (data.isActive !== undefined && options?.actorUserId) {
    await repository.createAuditLog({
      userId: options.actorUserId,
      endpoint: `/api/clients/${id}`,
      action: data.isActive ? 'ACTIVATE_CLIENT' : 'DEACTIVATE_CLIENT',
      status: 'success',
      details: `isActive=${data.isActive}`,
    });
  }

  if (data.lockDay !== undefined && options?.actorUserId) {
    await repository.createAuditLog({
      userId: options.actorUserId,
      endpoint: `/api/clients/${id}`,
      action: 'UPDATE_CLIENT_LOCK_DAY',
      status: 'success',
      details: `lockDay=${data.lockDay ?? 'null'}`,
    });
  }

  return client;
};

export const deleteClient = async (
  id: number,
  deletedBy?: number,
  repository: ClientRepository = defaultRepository
): Promise<void> => {
  await repository.softDeleteClient(id, deletedBy);
  await repository.createAuditLog({
    userId: deletedBy ?? null,
    endpoint: `/api/clients/${id}`,
    action: 'CLIENT_SOFT_DELETE',
    status: 'success',
    details: `Client ${id} soft deleted by ${deletedBy ?? 'system'}`,
  });
};

export const restoreClient = async (
  id: number,
  restoredBy?: number,
  repository: ClientRepository = defaultRepository
): Promise<IClient> => {
  const client = await repository.restoreClient(id, restoredBy);
  await repository.createAuditLog({
    userId: restoredBy ?? null,
    endpoint: `/api/clients/${id}/restore`,
    action: 'CLIENT_RESTORE',
    status: 'success',
    details: `Client ${id} restored by ${restoredBy ?? 'system'}`,
  });
  return client;
};

export const permanentlyDeleteClient = async (
  id: number,
  repository: ClientRepository = defaultRepository
): Promise<void> => {
  const client = await repository.findClientById(id);
  if (
    !client ||
    !('deletedAt' in client) ||
    !(client as IClient & { deletedAt?: Date | null }).deletedAt
  ) {
    throw new BadRequestError('Client must be soft-deleted first before permanent deletion');
  }
  await repository.permanentlyDeleteClient(id);
};

export const getClientUsers = async (
  clientId: number,
  repository: ClientRepository = defaultRepository
): Promise<IUser[]> => repository.listClientUsers(clientId);
