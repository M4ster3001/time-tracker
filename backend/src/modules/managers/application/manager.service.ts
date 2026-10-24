import { ForbiddenError } from '../../../app/errors/app-error.js';
import type { IClient } from '../../clients/domain/client.types.js';
import type { IUser } from '../../users/domain/user.types.js';
import { getMonthRangeUTC } from '../../../shared/domain/date.js';
import { getManagedConsultantIds } from '../../historical-access/application/historical-access.service.js';
import type { ManagerRepository } from '../domain/repositories/manager.repository.js';
import { managerRepository as defaultRepository } from '../infrastructure/repositories/prisma-manager.repository.js';

const buildDateRange = (year?: number, month?: number) => {
  if (!year) return null;
  if (month) {
    const range = getMonthRangeUTC(year, month);
    return {
      gte: range.start,
      lte: range.end,
    };
  }
  return {
    gte: new Date(Date.UTC(year, 0, 1)),
    lte: new Date(Date.UTC(year, 11, 31)),
  };
};

export const listManagerClients = async (
  managerId: number,
  year?: number,
  month?: number,
  repository: ManagerRepository = defaultRepository
): Promise<IClient[]> => {
  const range = buildDateRange(year, month);
  if (range) {
    const managedConsultantIds = await getManagedConsultantIds(managerId, {
      startDate: range.gte,
      endDate: range.lte,
    });
    const clientIds = await repository.clientIdsWithTimeEntries({
      userIds: [managerId, ...managedConsultantIds],
      range,
    });
    return repository.findActiveClientsByIds(clientIds);
  }

  return repository.findDirectAndManagedClients(managerId);
};

export const listManagedConsultants = async (
  managerId: number,
  clientId?: number,
  year?: number,
  month?: number,
  repository: ManagerRepository = defaultRepository
): Promise<IUser[]> => {
  const range = buildDateRange(year, month);
  if (range) {
    const managedConsultantIds = await getManagedConsultantIds(managerId, {
      startDate: range.gte,
      endDate: range.lte,
    });
    const userIds = await repository.userIdsWithTimeEntries({
      userIds: managedConsultantIds,
      clientId,
      range,
    });
    return repository.findActiveUsersByIds(userIds);
  }

  if (!clientId) {
    return repository.findConsultantsByManager(managerId);
  }

  return repository.findConsultantsByManagerAndClient(managerId, clientId);
};

export const updateManagerClientLockDay = async (
  managerId: number,
  clientId: number,
  lockDay: number | null,
  options?: { actorUserId?: number },
  repository: ManagerRepository = defaultRepository
): Promise<IClient> => {
  // SEC-CRIT-01: Manager must be directly linked to the client to modify lockDay
  const directLink = await repository.findDirectUserClientLink(managerId, clientId);
  if (!directLink) {
    throw new ForbiddenError('Manager does not have access to this client');
  }

  const updated = await repository.updateClientLockDay(clientId, lockDay);

  if (options?.actorUserId) {
    await repository.createAuditLog({
      userId: options.actorUserId,
      endpoint: `/api/manager/clients/${clientId}/lock-day`,
      action: 'UPDATE_CLIENT_LOCK_DAY',
      status: 'success',
      details: `lockDay=${lockDay ?? 'null'}`,
    });
  }

  return updated;
};
