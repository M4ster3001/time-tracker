import type { Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../../app/errors/app-error.js';
import type { ITemporaryUnlock } from '../domain/temporary-unlock.types.js';
import type {
  TemporaryUnlockDetails,
  TemporaryUnlockListItem,
  TemporaryUnlockRepository,
} from '../domain/repositories/temporary-unlock.repository.js';
import { prismaTemporaryUnlockRepository } from '../infrastructure/repositories/prisma-temporary-unlock.repository.js';

const MAX_UNLOCK_HOURS = 24;

const toInputJsonValue = (
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | undefined => {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

const validateGrantInput = (data: {
  periodYear: number;
  periodMonth: number;
  reason: string;
  durationHours?: number;
}) => {
  if (data.periodMonth < 1 || data.periodMonth > 12) {
    throw new BadRequestError('Invalid month');
  }
  if (data.periodYear < 2000 || data.periodYear > 2100) {
    throw new BadRequestError('Invalid year');
  }
  if (!data.reason || data.reason.trim().length < 5) {
    throw new BadRequestError('Reason must be at least 5 characters');
  }
  const hours = Math.min(data.durationHours ?? MAX_UNLOCK_HOURS, MAX_UNLOCK_HOURS);
  if (hours <= 0) {
    throw new BadRequestError('Duration must be positive');
  }
  return hours;
};

export class TemporaryUnlockService {
  constructor(
    private readonly repository: TemporaryUnlockRepository = prismaTemporaryUnlockRepository
  ) {}

  async grantTemporaryUnlock(data: {
    userId: number;
    clientId: number;
    grantedBy: number;
    periodYear: number;
    periodMonth: number;
    reason: string;
    durationHours?: number;
  }): Promise<ITemporaryUnlock> {
    const hours = validateGrantInput(data);

    const [user, client] = await Promise.all([
      this.repository.findUserStatus(data.userId),
      this.repository.findClientStatus(data.clientId),
    ]);

    if (!user || !user.isActive) {
      throw new NotFoundError('User not found or inactive');
    }
    if (!client || !client.isActive) {
      throw new NotFoundError('Client not found or inactive');
    }

    const hasLink = await this.repository.hasUserClientLink(data.userId, data.clientId);
    if (!hasLink) {
      throw new BadRequestError('User is not assigned to this client');
    }

    const existing = await this.repository.findActiveUnlockForPeriod({
      userId: data.userId,
      clientId: data.clientId,
      periodYear: data.periodYear,
      periodMonth: data.periodMonth,
      now: new Date(),
    });
    if (existing) {
      throw new BadRequestError('An active unlock already exists for this user/client/period');
    }

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const unlock = await this.repository.createTemporaryUnlock({
      userId: data.userId,
      clientId: data.clientId,
      grantedBy: data.grantedBy,
      periodYear: data.periodYear,
      periodMonth: data.periodMonth,
      reason: data.reason.trim(),
      expiresAt,
    });

    await this.repository.createAuditLog({
      userId: data.grantedBy,
      endpoint: '/api/admin/temporary-unlocks',
      action: 'TEMPORARY_UNLOCK_GRANT',
      status: 'success',
      details: `Granted temp unlock for user ${data.userId}, client ${data.clientId}, period ${data.periodYear}-${String(data.periodMonth).padStart(2, '0')}, expires ${expiresAt.toISOString()}`,
    });

    return unlock;
  }

  async revokeTemporaryUnlock(unlockId: number, revokedBy: number): Promise<ITemporaryUnlock> {
    const unlock = await this.repository.findTemporaryUnlockById(unlockId);
    if (!unlock) {
      throw new NotFoundError('Temporary unlock not found');
    }
    if (unlock.revokedAt) {
      throw new BadRequestError('Temporary unlock already revoked');
    }
    if (unlock.expiresAt <= new Date()) {
      throw new BadRequestError('Temporary unlock already expired');
    }

    const updated = await this.repository.updateTemporaryUnlock(unlockId, {
      revokedAt: new Date(),
    });

    await this.repository.createAuditLog({
      userId: revokedBy,
      endpoint: `/api/admin/temporary-unlocks/${unlockId}/revoke`,
      action: 'TEMPORARY_UNLOCK_REVOKE',
      status: 'success',
      details: `Revoked temp unlock ${unlockId} for user ${unlock.userId}`,
    });

    return updated;
  }

  async hasActiveTemporaryUnlock(
    userId: number,
    clientId: number,
    entryDate: Date
  ): Promise<{ unlockId: number } | null> {
    return this.repository.findActiveTemporaryUnlockByEntryDate({
      userId,
      clientId,
      periodYear: entryDate.getUTCFullYear(),
      periodMonth: entryDate.getUTCMonth() + 1,
      now: new Date(),
    });
  }

  async recordTemporaryUnlockEdit(data: {
    temporaryUnlockId: number;
    timeEntryId: number | null;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    previousData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.repository.createTemporaryUnlockEdit({
      temporaryUnlockId: data.temporaryUnlockId,
      timeEntryId: data.timeEntryId,
      action: data.action,
      previousData: toInputJsonValue(data.previousData),
      newData: toInputJsonValue(data.newData),
    });
  }

  async listTemporaryUnlocks(filters: {
    userId?: number;
    clientId?: number;
    activeOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    data: TemporaryUnlockListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
    const result = await this.repository.listTemporaryUnlocks({
      userId: filters.userId,
      clientId: filters.clientId,
      activeOnly: filters.activeOnly,
      page,
      limit,
      now: new Date(),
    });

    return {
      data: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  getTemporaryUnlockDetails(unlockId: number): Promise<TemporaryUnlockDetails | null> {
    return this.repository.findTemporaryUnlockDetails(unlockId);
  }
}

const temporaryUnlockService = new TemporaryUnlockService();

export const grantTemporaryUnlock =
  temporaryUnlockService.grantTemporaryUnlock.bind(temporaryUnlockService);
export const revokeTemporaryUnlock =
  temporaryUnlockService.revokeTemporaryUnlock.bind(temporaryUnlockService);
export const hasActiveTemporaryUnlock =
  temporaryUnlockService.hasActiveTemporaryUnlock.bind(temporaryUnlockService);
export const recordTemporaryUnlockEdit =
  temporaryUnlockService.recordTemporaryUnlockEdit.bind(temporaryUnlockService);
export const listTemporaryUnlocks =
  temporaryUnlockService.listTemporaryUnlocks.bind(temporaryUnlockService);
export const getTemporaryUnlockDetails =
  temporaryUnlockService.getTemporaryUnlockDetails.bind(temporaryUnlockService);
