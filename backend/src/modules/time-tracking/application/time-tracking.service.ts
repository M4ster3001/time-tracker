import { isEntryLocked } from '../../../shared/domain/policies/time-entry-lock.policy.js';
import { getMonthRangeUTC, normalizeDateOnly } from '../../../shared/domain/date.js';
import { sanitizeActivityDescription } from '../../../shared/domain/validation/text.js';
import { ForbiddenError } from '../../../app/errors/app-error.js';
import { recordActivityTag } from '../../../services/activity-tag.service.js';
import { summarizeActivity } from '../../../services/ai.service.js';
import {
  canConsultantAccessClientWithHistory,
  getManagedConsultantIds,
} from '../../historical-access/application/historical-access.service.js';
import {
  hasActiveTemporaryUnlock,
  recordTemporaryUnlockEdit,
} from '../../../services/temporary-unlock.service.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { formatDateKeyUTC } from '../../../services/date/utc-date.service.js';
import type { ITimeEntry, TimeEntrySource } from '../domain/time-entry.types.js';
import {
  assertTimeEntryAccess,
  canBypassLockForCorrection,
} from '../domain/policies/time-entry-access.policy.js';
import {
  assertDailyLimit,
  normalizeAndValidateEntryDate,
  validateDurationMinutes,
} from '../domain/services/time-entry-validation.service.js';
import { resolveLockDay } from '../domain/policies/time-entry-lock.policy.js';
import type { TimeEntryRepository } from '../domain/repositories/time-entry.repository.js';
import { timeEntryRepository } from '../infrastructure/repositories/prisma-time-entry.repository.js';
import type {
  MonthSummary,
  SupervisedTimeEntryFilters,
  SupervisedTimeEntryItem,
} from './time-tracking.types.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import { assertProjectUsableForEntry } from '../../projects/application/project.service.js';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';

export type TimeTrackingServiceDeps = {
  repository: TimeEntryRepository;
  canConsultantAccessClientWithHistory: typeof canConsultantAccessClientWithHistory;
  getManagedConsultantIds: typeof getManagedConsultantIds;
  hasActiveTemporaryUnlock: typeof hasActiveTemporaryUnlock;
  recordTemporaryUnlockEdit: typeof recordTemporaryUnlockEdit;
  recordActivityTag: typeof recordActivityTag;
  summarizeActivity: typeof summarizeActivity;
};

const defaultDeps: TimeTrackingServiceDeps = {
  repository: timeEntryRepository,
  canConsultantAccessClientWithHistory,
  getManagedConsultantIds,
  hasActiveTemporaryUnlock,
  recordTemporaryUnlockEdit,
  recordActivityTag,
  summarizeActivity,
};

const assertClientHistoryAccess = async (
  deps: TimeTrackingServiceDeps,
  userId: number,
  clientId: number
): Promise<void> => {
  const hasAccess = await deps.canConsultantAccessClientWithHistory(userId, clientId);
  if (hasAccess) return;
  throw new ForbiddenError('User does not have access to this client');
};

/** PRJ-01: aplica projeto so com flow ligado; exige quando o cliente pede. */
const resolveProjectIdForWrite = async (
  clientId: number,
  projectId: number | null | undefined
): Promise<number | null> => {
  const flows = await getFlows();
  if (!flows.projects) {
    if (projectId != null) throw new ForbiddenError('FLOW_DISABLED');
    return null;
  }
  const client = await prisma.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { requireProjectOnEntries: true },
  });
  await assertProjectUsableForEntry({
    clientId,
    projectId: projectId ?? null,
    requireProject: Boolean(client?.requireProjectOnEntries),
  });
  return projectId ?? null;
};

const maybeRecordAiSummary = (
  deps: TimeTrackingServiceDeps,
  userId: number,
  activityDescription: string
): void => {
  if (activityDescription.length < 50) return;

  deps
    .summarizeActivity(activityDescription)
    .then((summary) => {
      if (!summary) return;
      return deps.recordActivityTag(userId, summary, { aiGenerated: true }).catch((error) => {
        logger.error({ err: error }, '[AI] Failed to record summarized tag');
      });
    })
    .catch((error) => {
      logger.error({ err: error }, '[AI] Failed to summarize activity');
    });
};

const logPrivilegedCorrection = async (
  deps: TimeTrackingServiceDeps,
  params: {
    actorUserId: number;
    actorRoleId?: number;
    targetUserId: number;
    timeEntryId: number;
    action: 'UPDATE_TIME_ENTRY' | 'DELETE_TIME_ENTRY';
    details: Record<string, unknown>;
  }
): Promise<void> => {
  if (params.actorUserId === params.targetUserId) return;
  if (params.actorRoleId !== 1 && params.actorRoleId !== 2) return;

  try {
    await deps.repository.createAuditLog({
      userId: params.actorUserId,
      endpoint: '/api/time-entries/:id',
      action: params.action,
      status: 'success',
      details: JSON.stringify({
        actorRoleId: params.actorRoleId,
        targetUserId: params.targetUserId,
        timeEntryId: params.timeEntryId,
        ...params.details,
      }).slice(0, 4000),
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to log privileged time entry correction');
  }
};

export class TimeTrackingService {
  constructor(private readonly deps: TimeTrackingServiceDeps = defaultDeps) {}

  async createTimeEntry(data: {
    userId: number;
    clientId: number;
    date: Date;
    activityDescription: string;
    durationMinutes: number;
    projectId?: number | null;
    source?: TimeEntrySource;
    uuid?: string;
  }): Promise<ITimeEntry> {
    const clientLockDay = await this.deps.repository.findClientLockDay(data.clientId);
    const lockDay = resolveLockDay(clientLockDay);
    let tempUnlockId: number | null = null;

    if (isEntryLocked(data.date, lockDay)) {
      const tempUnlock = await this.deps.hasActiveTemporaryUnlock(
        data.userId,
        data.clientId,
        data.date
      );
      if (!tempUnlock) {
        throw new ForbiddenError('Time entry month is locked');
      }
      tempUnlockId = tempUnlock.unlockId;
    }

    const hasCurrentLink = await this.deps.repository.hasUserClientLink(data.userId, data.clientId);
    if (!hasCurrentLink) {
      throw new ForbiddenError('User does not have access to this client');
    }

    validateDurationMinutes(data.durationMinutes);
    const entryDate = normalizeAndValidateEntryDate(data.date);
    const usedMinutes = await this.deps.repository.sumUserDayMinutes(data.userId, entryDate);
    assertDailyLimit(usedMinutes, data.durationMinutes);

    const projectId = await resolveProjectIdForWrite(data.clientId, data.projectId);

    const sanitizedDescription = sanitizeActivityDescription(data.activityDescription);
    const timeEntry = await this.deps.repository.createTimeEntry({
      userId: data.userId,
      clientId: data.clientId,
      date: entryDate,
      activityDescription: sanitizedDescription,
      durationMinutes: data.durationMinutes,
      projectId,
      source: data.source ?? 'PORTAL',
      ...(data.uuid ? { uuid: data.uuid } : {}),
    });

    if (tempUnlockId) {
      await this.deps.recordTemporaryUnlockEdit({
        temporaryUnlockId: tempUnlockId,
        timeEntryId: timeEntry.id,
        action: 'CREATE',
        newData: {
          clientId: data.clientId,
          date: entryDate.toISOString(),
          activityDescription: sanitizedDescription,
          durationMinutes: data.durationMinutes,
        },
      });
    }

    await this.deps.recordActivityTag(data.userId, sanitizedDescription, {
      clientId: data.clientId,
      durationMinutes: data.durationMinutes,
    });
    maybeRecordAiSummary(this.deps, data.userId, sanitizedDescription);
    return timeEntry;
  }

  getTimeEntriesByUser(userId: number): Promise<ITimeEntry[]> {
    return this.deps.repository.findTimeEntriesByUser(userId);
  }

  async getTimeEntriesByMonth(userId: number, year: number, month: number): Promise<ITimeEntry[]> {
    const { start, end } = getMonthRangeUTC(year, month);
    return this.deps.repository.findTimeEntriesByUserAndMonth(userId, start, end);
  }

  async getTimeEntriesByClient(userId: number, clientId: number): Promise<ITimeEntry[]> {
    await assertClientHistoryAccess(this.deps, userId, clientId);
    return this.deps.repository.findTimeEntriesByUserAndClient(userId, clientId);
  }

  async getTimeEntriesByClientAndMonth(
    userId: number,
    clientId: number,
    year: number,
    month: number
  ): Promise<ITimeEntry[]> {
    await assertClientHistoryAccess(this.deps, userId, clientId);
    const { start, end } = getMonthRangeUTC(year, month);
    return this.deps.repository.findTimeEntriesByUserAndClientAndMonth(
      userId,
      clientId,
      start,
      end
    );
  }

  async getTimeEntryById(id: number, userId: number, callerRoleId?: number): Promise<ITimeEntry> {
    const timeEntry = await this.deps.repository.findTimeEntryById(id);
    await assertTimeEntryAccess(this.deps.repository, timeEntry, userId, callerRoleId);
    return timeEntry as ITimeEntry;
  }

  async getTotalHoursByMonth(userId: number, year: number, month: number): Promise<number> {
    const { start, end } = getMonthRangeUTC(year, month);
    return this.deps.repository.aggregateMonthMinutes(userId, start, end);
  }

  async getMonthSummary(userId: number, year: number, month: number): Promise<MonthSummary> {
    const { start, end } = getMonthRangeUTC(year, month);
    const [totalMinutes, grouped] = await Promise.all([
      this.deps.repository.aggregateMonthMinutes(userId, start, end),
      this.deps.repository.groupMonthMinutesByClient(userId, start, end),
    ]);

    const clientIds = grouped.map((item) => item.clientId);
    const clients =
      clientIds.length > 0 ? await this.deps.repository.findClientsByIds(clientIds) : [];
    const clientById = new Map(clients.map((client) => [client.id, client]));

    return {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      byClient: grouped.map((item) => {
        const client = clientById.get(item.clientId);
        return {
          clientId: item.clientId,
          clientName: client?.name ?? 'Unknown',
          paysOvertime: client?.paysOvertime ?? true,
          minutes: item.minutes,
        };
      }),
    };
  }

  async getTotalHoursByClientAndMonth(
    userId: number,
    clientId: number,
    year: number,
    month: number
  ): Promise<number> {
    await assertClientHistoryAccess(this.deps, userId, clientId);
    const { start, end } = getMonthRangeUTC(year, month);
    return this.deps.repository.aggregateClientMonthMinutes(userId, clientId, start, end);
  }

  async createBulkTimeEntries(
    userId: number,
    entries: Array<{
      clientId: number;
      date: Date;
      activityDescription: string;
      durationMinutes: number;
      projectId?: number | null;
    }>,
    source: TimeEntrySource = 'PORTAL'
  ): Promise<ITimeEntry[]> {
    const clientIds = Array.from(new Set(entries.map((entry) => entry.clientId)));
    const normalizedDates = entries.map((entry) => normalizeAndValidateEntryDate(entry.date));
    const allowedClientIds = await this.deps.repository.findUserClientLinks(userId, clientIds);
    if (allowedClientIds.length !== clientIds.length) {
      throw new ForbiddenError('User does not have access to one or more clients');
    }

    const clients = await this.deps.repository.findClientsByIds(clientIds);
    const lockDayByClient = new Map(clients.map((client) => [client.id, client.lockDay]));
    const uniqueDates = Array.from(
      new Set(normalizedDates.map((date) => formatDateKeyUTC(date)))
    ).map((key) => new Date(`${key}T00:00:00.000Z`));

    const existingByDate = new Map<string, number>();
    await Promise.all(
      uniqueDates.map(async (date) => {
        existingByDate.set(
          formatDateKeyUTC(date),
          await this.deps.repository.sumUserDayMinutes(userId, date)
        );
      })
    );

    const resolvedProjectIds: Array<number | null> = [];
    const payloadByDate = new Map<string, number>();
    for (const [index, entry] of entries.entries()) {
      validateDurationMinutes(entry.durationMinutes);
      const normalizedDate = normalizedDates[index];
      const lockDay = resolveLockDay(lockDayByClient.get(entry.clientId));
      if (isEntryLocked(normalizedDate, lockDay)) {
        const tempUnlock = await this.deps.hasActiveTemporaryUnlock(
          userId,
          entry.clientId,
          normalizedDate
        );
        if (!tempUnlock) {
          throw new ForbiddenError('Time entry month is locked');
        }
      }

      resolvedProjectIds.push(
        await resolveProjectIdForWrite(entry.clientId, entry.projectId)
      );

      const dateKey = formatDateKeyUTC(normalizedDate);
      payloadByDate.set(dateKey, (payloadByDate.get(dateKey) ?? 0) + entry.durationMinutes);
      assertDailyLimit(existingByDate.get(dateKey) ?? 0, payloadByDate.get(dateKey) ?? 0);
    }

    const sanitizedEntries = entries.map((entry, index) => ({
      clientId: entry.clientId,
      date: normalizedDates[index],
      activityDescription: sanitizeActivityDescription(entry.activityDescription),
      durationMinutes: entry.durationMinutes,
      projectId: resolvedProjectIds[index],
    }));

    const created = await this.deps.repository.createBulkTimeEntries(
      userId,
      sanitizedEntries,
      source
    );
    await Promise.all(
      sanitizedEntries.map((entry) =>
        this.deps.recordActivityTag(userId, entry.activityDescription, {
          clientId: entry.clientId,
          durationMinutes: entry.durationMinutes,
        })
      )
    );
    sanitizedEntries.forEach((entry) =>
      maybeRecordAiSummary(this.deps, userId, entry.activityDescription)
    );

    return created;
  }

  async updateTimeEntry(
    id: number,
    userId: number,
    data: {
      clientId?: number;
      date?: Date;
      activityDescription?: string;
      durationMinutes?: number;
      projectId?: number | null;
    },
    callerRoleId?: number
  ): Promise<ITimeEntry> {
    const entry = await this.deps.repository.findTimeEntryById(id);
    await assertTimeEntryAccess(this.deps.repository, entry, userId, callerRoleId);
    const currentEntry = entry as ITimeEntry;
    const bypassLock = canBypassLockForCorrection(currentEntry.userId, userId, callerRoleId);

    const currentLockDay = resolveLockDay(
      await this.deps.repository.findClientLockDay(currentEntry.clientId)
    );
    let tempUnlockId: number | null = null;

    if (!bypassLock && isEntryLocked(currentEntry.date, currentLockDay)) {
      const tempUnlock = await this.deps.hasActiveTemporaryUnlock(
        currentEntry.userId,
        currentEntry.clientId,
        currentEntry.date
      );
      if (!tempUnlock) {
        throw new ForbiddenError('Time entry month is locked');
      }
      tempUnlockId = tempUnlock.unlockId;
    }

    if (!bypassLock && data.date) {
      const normalizedNextDate = normalizeDateOnly(data.date);
      const sameUnlockPeriod = normalizedNextDate.getUTCFullYear() === currentEntry.date.getUTCFullYear() &&
        normalizedNextDate.getUTCMonth() === currentEntry.date.getUTCMonth();
      if (isEntryLocked(normalizedNextDate, currentLockDay) && (!tempUnlockId || !sameUnlockPeriod)) {
        const tempUnlock = await this.deps.hasActiveTemporaryUnlock(
          currentEntry.userId,
          currentEntry.clientId,
          normalizedNextDate
        );
        if (!tempUnlock) {
          throw new ForbiddenError('Time entry month is locked');
        }
        tempUnlockId = tempUnlock.unlockId;
      }
    }

    if (data.clientId && data.clientId !== currentEntry.clientId) {
      await assertClientHistoryAccess(this.deps, currentEntry.userId, data.clientId);
      const targetDate = data.date ? normalizeDateOnly(data.date) : currentEntry.date;
      const targetLockDay = resolveLockDay(
        await this.deps.repository.findClientLockDay(data.clientId)
      );
      if (!bypassLock && isEntryLocked(targetDate, targetLockDay)) {
        const tempUnlock = await this.deps.hasActiveTemporaryUnlock(
          currentEntry.userId,
          data.clientId,
          targetDate
        );
        if (!tempUnlock) {
          throw new ForbiddenError('Time entry month is locked');
        }
        tempUnlockId = tempUnlock.unlockId;
      }
    }

    if (data.durationMinutes !== undefined) {
      validateDurationMinutes(data.durationMinutes);
    }

    const nextDate = data.date ? normalizeAndValidateEntryDate(data.date) : currentEntry.date;
    const nextDuration = data.durationMinutes ?? currentEntry.durationMinutes;
    const usedMinutes = await this.deps.repository.sumUserDayMinutesExcludingEntry(
      currentEntry.userId,
      nextDate,
      currentEntry.id
    );
    assertDailyLimit(usedMinutes, nextDuration);

    const sanitizedDescription = data.activityDescription
      ? sanitizeActivityDescription(data.activityDescription)
      : undefined;

    const nextClientId = data.clientId ?? currentEntry.clientId;
    const projectId =
      data.projectId !== undefined || data.clientId !== undefined
        ? await resolveProjectIdForWrite(
            nextClientId,
            data.projectId !== undefined ? data.projectId : currentEntry.projectId
          )
        : undefined;

    const previousSnapshot = tempUnlockId
      ? {
          clientId: currentEntry.clientId,
          date: currentEntry.date.toISOString(),
          activityDescription: currentEntry.activityDescription,
          durationMinutes: currentEntry.durationMinutes,
        }
      : null;

    const updatedEntry = await this.deps.repository.updateTimeEntry(id, {
      ...(data.clientId ? { clientId: data.clientId } : {}),
      ...(data.date ? { date: normalizeDateOnly(data.date) } : {}),
      ...(sanitizedDescription ? { activityDescription: sanitizedDescription } : {}),
      ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
    }, { userId: currentEntry.userId, date: nextDate, durationMinutes: nextDuration,
      previousClientId: currentEntry.clientId, previousDate: currentEntry.date,
      expectedUpdatedAt: currentEntry.updatedAt });

    if (tempUnlockId) {
      await this.deps.recordTemporaryUnlockEdit({
        temporaryUnlockId: tempUnlockId,
        timeEntryId: updatedEntry.id,
        action: 'UPDATE',
        previousData: previousSnapshot,
        newData: {
          clientId: updatedEntry.clientId,
          date: updatedEntry.date.toISOString(),
          activityDescription: updatedEntry.activityDescription,
          durationMinutes: updatedEntry.durationMinutes,
        },
      });
    }

    if (sanitizedDescription || data.durationMinutes !== undefined || data.clientId !== undefined) {
      await this.deps.recordActivityTag(userId, updatedEntry.activityDescription, {
        clientId: updatedEntry.clientId,
        durationMinutes: updatedEntry.durationMinutes,
      });
    }

    if (sanitizedDescription) {
      maybeRecordAiSummary(this.deps, userId, sanitizedDescription);
    }

    await logPrivilegedCorrection(this.deps, {
      actorUserId: userId,
      actorRoleId: callerRoleId,
      targetUserId: currentEntry.userId,
      timeEntryId: updatedEntry.id,
      action: 'UPDATE_TIME_ENTRY',
      details: {
        fromClientId: currentEntry.clientId,
        toClientId: updatedEntry.clientId,
        fromDate: currentEntry.date.toISOString(),
        toDate: updatedEntry.date.toISOString(),
        fromDurationMinutes: currentEntry.durationMinutes,
        toDurationMinutes: updatedEntry.durationMinutes,
      },
    });

    return updatedEntry;
  }

  async deleteTimeEntry(id: number, userId: number, callerRoleId?: number): Promise<void> {
    const entry = await this.deps.repository.findTimeEntryById(id);
    await assertTimeEntryAccess(this.deps.repository, entry, userId, callerRoleId);
    const currentEntry = entry as ITimeEntry;
    const bypassLock = canBypassLockForCorrection(currentEntry.userId, userId, callerRoleId);
    const lockDay = resolveLockDay(
      await this.deps.repository.findClientLockDay(currentEntry.clientId)
    );
    let tempUnlockId: number | null = null;

    if (!bypassLock && isEntryLocked(currentEntry.date, lockDay)) {
      const tempUnlock = await this.deps.hasActiveTemporaryUnlock(
        currentEntry.userId,
        currentEntry.clientId,
        currentEntry.date
      );
      if (!tempUnlock) {
        throw new ForbiddenError('Time entry month is locked');
      }
      tempUnlockId = tempUnlock.unlockId;
    }

    if (tempUnlockId) {
      await this.deps.recordTemporaryUnlockEdit({
        temporaryUnlockId: tempUnlockId,
        timeEntryId: currentEntry.id,
        action: 'DELETE',
        previousData: {
          clientId: currentEntry.clientId,
          date: currentEntry.date.toISOString(),
          activityDescription: currentEntry.activityDescription,
          durationMinutes: currentEntry.durationMinutes,
        },
      });
    }

    await this.deps.repository.deleteTimeEntry(id);

    await logPrivilegedCorrection(this.deps, {
      actorUserId: userId,
      actorRoleId: callerRoleId,
      targetUserId: currentEntry.userId,
      timeEntryId: currentEntry.id,
      action: 'DELETE_TIME_ENTRY',
      details: {
        clientId: currentEntry.clientId,
        date: currentEntry.date.toISOString(),
        durationMinutes: currentEntry.durationMinutes,
      },
    });
  }

  async getTimeEntriesByManagedConsultants(
    managerId: number,
    year: number,
    month: number
  ): Promise<
    Array<{ consultant: { id: number; name: string; email: string }; timeEntries: ITimeEntry[] }>
  > {
    const consultants = await this.deps.repository.findManagedConsultants(managerId);
    const { start, end } = getMonthRangeUTC(year, month);
    const result: Array<{
      consultant: { id: number; name: string; email: string };
      timeEntries: ITimeEntry[];
    }> = [];

    for (const consultant of consultants) {
      result.push({
        consultant,
        timeEntries: await this.deps.repository.findTimeEntriesByUserAndMonth(
          consultant.id,
          start,
          end
        ),
      });
    }

    return result;
  }

  async getSupervisedTimeEntries(filters: SupervisedTimeEntryFilters): Promise<{
    items: SupervisedTimeEntryItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (filters.actorRoleId !== 1 && filters.actorRoleId !== 2) {
      throw new ForbiddenError('Forbidden');
    }

    const roleScope = filters.actorRoleId === 1 ? [2, 3] : [3];

    if (filters.userId) {
      if (filters.actorRoleId === 2) {
        const managedIds = await this.deps.getManagedConsultantIds(filters.actorUserId, {
          startDate: filters.startDate,
          endDate: filters.endDate,
        });
        if (!managedIds.includes(filters.userId)) {
          throw new ForbiddenError('Forbidden');
        }
      }

      const allowedUser = await this.deps.repository.findAllowedSupervisedUser(
        filters.userId,
        roleScope
      );
      if (!allowedUser) {
        throw new ForbiddenError('Forbidden');
      }
    }

    if (filters.actorRoleId === 2) {
      const scoped = await this.deps.repository.queryManagerSupervisedEntryIds({
        actorUserId: filters.actorUserId,
        userId: filters.userId,
        clientId: filters.clientId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: filters.page,
        limit: filters.limit,
      });

      const rows =
        scoped.ids.length > 0
          ? await this.deps.repository.findEntriesWithRelationsByIds(scoped.ids)
          : [];
      return {
        items: rows.map((row) => ({
          ...row,
          locked: isEntryLocked(row.date, resolveLockDay(row.client.lockDay)),
        })),
        total: scoped.total,
        page: filters.page,
        limit: filters.limit,
      };
    }

    const adminResult = await this.deps.repository.findSupervisedEntriesForAdmin({
      roleIds: roleScope,
      userId: filters.userId,
      clientId: filters.clientId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      page: filters.page,
      limit: filters.limit,
    });

    return {
      items: adminResult.rows.map((row) => ({
        ...row,
        locked: isEntryLocked(row.date, resolveLockDay(row.client.lockDay)),
      })),
      total: adminResult.total,
      page: filters.page,
      limit: filters.limit,
    };
  }
}

const buildService = (deps?: TimeTrackingServiceDeps) =>
  new TimeTrackingService(deps ?? defaultDeps);

export const withTimeEntryRepository = (repository: TimeEntryRepository): TimeTrackingService =>
  new TimeTrackingService({ ...defaultDeps, repository });

export const createTimeEntry = (
  data: Parameters<TimeTrackingService['createTimeEntry']>[0],
  deps?: TimeTrackingServiceDeps
) => buildService(deps).createTimeEntry(data);

export const getTimeEntriesByUser = (userId: number, deps?: TimeTrackingServiceDeps) =>
  buildService(deps).getTimeEntriesByUser(userId);

export const getTimeEntriesByMonth = (
  userId: number,
  year: number,
  month: number,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).getTimeEntriesByMonth(userId, year, month);

export const getTimeEntriesByClient = (
  userId: number,
  clientId: number,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).getTimeEntriesByClient(userId, clientId);

export const getTimeEntriesByClientAndMonth = (
  userId: number,
  clientId: number,
  year: number,
  month: number,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).getTimeEntriesByClientAndMonth(userId, clientId, year, month);

export const getTimeEntryById = (
  id: number,
  userId: number,
  callerRoleId?: number,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).getTimeEntryById(id, userId, callerRoleId);

export const getTotalHoursByMonth = (
  userId: number,
  year: number,
  month: number,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).getTotalHoursByMonth(userId, year, month);

export const getMonthSummary = (
  userId: number,
  year: number,
  month: number,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).getMonthSummary(userId, year, month);

export const getTotalHoursByClientAndMonth = (
  userId: number,
  clientId: number,
  year: number,
  month: number,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).getTotalHoursByClientAndMonth(userId, clientId, year, month);

export const createBulkTimeEntries = (
  userId: number,
  entries: Parameters<TimeTrackingService['createBulkTimeEntries']>[1],
  source?: TimeEntrySource,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).createBulkTimeEntries(userId, entries, source);

export const updateTimeEntry = (
  id: number,
  userId: number,
  data: Parameters<TimeTrackingService['updateTimeEntry']>[2],
  callerRoleId?: number,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).updateTimeEntry(id, userId, data, callerRoleId);

export const deleteTimeEntry = (
  id: number,
  userId: number,
  callerRoleId?: number,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).deleteTimeEntry(id, userId, callerRoleId);

export const getTimeEntriesByManagedConsultants = (
  managerId: number,
  year: number,
  month: number,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).getTimeEntriesByManagedConsultants(managerId, year, month);

export const getSupervisedTimeEntries = (
  filters: SupervisedTimeEntryFilters,
  deps?: TimeTrackingServiceDeps
) => buildService(deps).getSupervisedTimeEntries(filters);
