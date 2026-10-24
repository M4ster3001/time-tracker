import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../../app/http/presenters/api.presenter.js';
import { parseDurationMinutes } from '../../../shared/domain/duration.js';
import { parseDateOnly } from '../../../shared/domain/date.js';
import {
  toAppError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../../app/errors/app-error.js';
import { config } from '../../../config.js';
import { isMonthLocked } from '../../../shared/domain/policies/time-entry-lock.policy.js';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { hasActiveTemporaryUnlock } from '../../../services/temporary-unlock.service.js';
import {
  getAccessibleClientIdsForConsultant,
  getAccessibleClientIdsForManager,
} from '../../historical-access/application/historical-access.service.js';
import {
  cacheGet,
  cacheSet,
  CACHE_KEYS,
  invalidateTimeEntryRelatedCaches,
} from '../../../shared/infrastructure/cache/cache.service.js';
import {
  createTimeEntry,
  getTimeEntriesByMonth,
  getTimeEntriesByClientAndMonth,
  getTimeEntryById,
  updateTimeEntry,
  deleteTimeEntry,
  getMonthSummary,
  createBulkTimeEntries,
  getSupervisedTimeEntries,
} from '../../../services/timeentry.service.js';
import type { TimeEntrySource } from '../domain/time-entry.types.js';
import { withDurationContract } from '../../../shared/domain/duration-contract.js';
import { withEmbeddedEstimateRevision } from '../../estimates/domain/embed-estimate-revision.js';
import { assertListTimeEntriesBounded } from '../application/use-cases/list-time-entries.policy.js';

/** Origem do lancamento inferida do tipo de bearer token usado na requisicao. */
const resolveTimeEntrySource = (req: Request): TimeEntrySource =>
  req.authTokenType === 'pat' ? 'API' : 'PORTAL';

const MAX_BULK_ENTRIES = 100;

const parseNumber = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const requireUser = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Unauthorized');
  return req.user;
};

const respondFailure = (res: Response, error: unknown): void => {
  sendError(res, toAppError(error));
};

/** DAT-01/TRK-01: medicao so via sessao explicita; rejeita escrita direta no portal/API. */
const rejectDirectActualTrackedWrite = (body: Record<string, unknown>): void => {
  if (body.actualTrackedDurationMinutes !== undefined) {
    throw new BadRequestError('ACTUAL_TRACKED_WRITE_REQUIRES_TRACKING_SESSION');
  }
  if (body.deriveActualFrom != null) {
    throw new BadRequestError('ACTUAL_TRACKED_DERIVATION_FORBIDDEN');
  }
};

export const createTimeEntryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireUser(req);
    rejectDirectActualTrackedWrite(req.body as Record<string, unknown>);
    const { clientId, date, activityDescription, durationMinutes, projectId } = req.body;
    const parsedDuration = parseDurationMinutes(durationMinutes);

    if (!clientId || !date || !activityDescription || parsedDuration === null) {
      throw new BadRequestError('Missing required fields');
    }

    const parsedDate = parseDateOnly(date);
    if (!parsedDate) {
      throw new BadRequestError('Invalid date');
    }

    const timeEntry = await createTimeEntry({
      userId: user.userId,
      clientId: Number(clientId),
      date: parsedDate,
      activityDescription: String(activityDescription),
      durationMinutes: parsedDuration,
      projectId: projectId == null ? null : Number(projectId),
      source: resolveTimeEntrySource(req),
    });

    await invalidateTimeEntryRelatedCaches(user.userId);
    sendSuccess(res, 201, withDurationContract(timeEntry));
  } catch (error) {
    respondFailure(res, error);
  }
};

export const listTimeEntriesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireUser(req);
    const month = parseNumber(req.query.month) ?? undefined;
    const year = parseNumber(req.query.year) ?? undefined;
    const clientId = parseNumber(req.query.clientId) ?? undefined;
    assertListTimeEntriesBounded({ month, year, clientId });

    const entries = clientId
      ? await getTimeEntriesByClientAndMonth(user.userId, clientId, year!, month!)
      : await getTimeEntriesByMonth(user.userId, year!, month!);

    sendSuccess(res, 200, entries.map((entry) => withDurationContract(entry)));
  } catch (error) {
    respondFailure(res, error);
  }
};

export const getTimeEntryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireUser(req);
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      throw new BadRequestError('Invalid id');
    }

    const timeEntry = await getTimeEntryById(id, user.userId, user.roleId);
    const workActivityId =
      timeEntry && typeof timeEntry === 'object' && 'workActivityId' in timeEntry
        ? (timeEntry as { workActivityId?: number | null }).workActivityId
        : null;
    const revisions =
      workActivityId == null
        ? []
        : await prisma.estimateRevision.findMany({
            where: { workActivityId },
            orderBy: { version: 'desc' },
            select: {
              id: true,
              uuid: true,
              version: true,
              baseMinutes: true,
              factor: true,
              suggestedMinutes: true,
              origin: true,
              algorithmVersion: true,
              createdAt: true,
            },
          });
    const withRevision = withEmbeddedEstimateRevision(timeEntry, revisions.map((row) => ({
      ...row,
      factor: Number(row.factor),
    })));
    sendSuccess(res, 200, withDurationContract(withRevision));
  } catch (error) {
    respondFailure(res, error);
  }
};

export const updateTimeEntryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireUser(req);
    rejectDirectActualTrackedWrite(req.body as Record<string, unknown>);
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      throw new BadRequestError('Invalid id');
    }

    const { clientId, date, activityDescription, durationMinutes, projectId } = req.body;
    if (
      !clientId &&
      !date &&
      !activityDescription &&
      durationMinutes === undefined &&
      projectId === undefined
    ) {
      throw new BadRequestError('No fields to update');
    }

    const payload: {
      clientId?: number;
      date?: Date;
      activityDescription?: string;
      durationMinutes?: number;
      projectId?: number | null;
    } = {};

    if (clientId) {
      const parsedClientId = parseNumber(clientId);
      if (!parsedClientId) throw new BadRequestError('Invalid clientId');
      payload.clientId = parsedClientId;
    }

    if (date) {
      const parsedDate = parseDateOnly(date);
      if (!parsedDate) throw new BadRequestError('Invalid date');
      payload.date = parsedDate;
    }

    if (activityDescription) payload.activityDescription = String(activityDescription);
    if (durationMinutes !== undefined) {
      const parsedDuration = parseDurationMinutes(durationMinutes);
      if (parsedDuration === null) throw new BadRequestError('Invalid duration');
      payload.durationMinutes = parsedDuration;
    }
    if (projectId !== undefined) {
      payload.projectId = projectId === null ? null : Number(projectId);
    }

    const existingEntry = await getTimeEntryById(id, user.userId, user.roleId);
    const updated = await updateTimeEntry(id, user.userId, payload, user.roleId);

    await invalidateTimeEntryRelatedCaches(updated.userId, [
      existingEntry.clientId,
      updated.clientId,
    ]);
    sendSuccess(res, 200, withDurationContract(updated));
  } catch (error) {
    respondFailure(res, error);
  }
};

export const deleteTimeEntryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireUser(req);
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new BadRequestError('Invalid id');

    await deleteTimeEntry(id, user.userId, user.roleId);
    await invalidateTimeEntryRelatedCaches(user.userId);
    sendSuccess(res, 200, undefined, 'Deleted');
  } catch (error) {
    respondFailure(res, error);
  }
};

export const monthSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireUser(req);
    const month = parseNumber(req.query.month);
    const year = parseNumber(req.query.year);
    if (!month || !year) {
      throw new BadRequestError('Month and year are required');
    }

    const summary = await getMonthSummary(user.userId, year, month);
    sendSuccess(res, 200, summary);
  } catch (error) {
    respondFailure(res, error);
  }
};

export const listSupervisedTimeEntriesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireUser(req);
    if (user.roleId !== 1 && user.roleId !== 2) {
      throw new ForbiddenError('Forbidden');
    }

    const userId = parseNumber(req.query.userId);
    const clientId = parseNumber(req.query.clientId);
    const page = Math.max(1, parseNumber(req.query.page) ?? 1);
    const limit = Math.min(100, Math.max(1, parseNumber(req.query.limit) ?? 20));
    const startDateRaw =
      typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined;
    const endDateRaw = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined;
    const startDate = startDateRaw ? parseDateOnly(startDateRaw) : null;
    const endDate = endDateRaw ? parseDateOnly(endDateRaw) : null;

    if (startDateRaw && !startDate) throw new BadRequestError('Invalid startDate');
    if (endDateRaw && !endDate) throw new BadRequestError('Invalid endDate');
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestError('startDate must be before or equal to endDate');
    }

    const data = await getSupervisedTimeEntries({
      actorUserId: user.userId,
      actorRoleId: user.roleId,
      userId: userId ?? undefined,
      clientId: clientId ?? undefined,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      page,
      limit,
    });

    sendSuccess(res, 200, data);
  } catch (error) {
    respondFailure(res, error);
  }
};

export const bulkTimeEntriesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireUser(req);
    const entries = req.body?.entries as Array<{
      clientId: number;
      date: string | Date;
      activityDescription: string;
      durationMinutes: number | string;
      projectId?: number | null;
    }>;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      throw new BadRequestError('Entries are required');
    }

    if (entries.length > MAX_BULK_ENTRIES) {
      throw new BadRequestError(`Maximum ${MAX_BULK_ENTRIES} entries allowed per bulk operation`);
    }

    const normalized = entries.map((entry) => {
      const parsedDuration = parseDurationMinutes(entry.durationMinutes);
      const parsedDate = parseDateOnly(entry.date);
      const rawProjectId = entry.projectId;
      return {
        clientId: Number(entry.clientId),
        date: parsedDate ?? new Date('invalid'),
        activityDescription: String(entry.activityDescription),
        durationMinutes: parsedDuration ?? NaN,
        projectId:
          rawProjectId === undefined || rawProjectId === null || Number(rawProjectId) === 0
            ? null
            : Number(rawProjectId),
      };
    });

    if (normalized.some((entry) => Number.isNaN(entry.durationMinutes))) {
      throw new BadRequestError('Invalid duration');
    }

    if (normalized.some((entry) => Number.isNaN(entry.date.getTime()))) {
      throw new BadRequestError('Invalid date');
    }

    const created = await createBulkTimeEntries(user.userId, normalized, resolveTimeEntrySource(req));
    await invalidateTimeEntryRelatedCaches(user.userId);
    sendSuccess(
      res,
      201,
      created.map((entry) => withDurationContract(entry))
    );
  } catch (error) {
    respondFailure(res, error);
  }
};

export const lockStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireUser(req);
    const month = parseNumber(req.query.month);
    const year = parseNumber(req.query.year);
    const clientId = parseNumber(req.query.clientId);

    if (!month || !year) {
      throw new BadRequestError('Month and year are required');
    }

    let lockDay = config.timeEntryLockDay;
    if (clientId) {
      if (user.roleId === 3) {
        const accessibleClientIds = await getAccessibleClientIdsForConsultant(user.userId, [
          clientId,
        ]);
        if (!accessibleClientIds.includes(clientId)) throw new ForbiddenError('Forbidden');
      }
      if (user.roleId === 2) {
        const accessibleClientIds = await getAccessibleClientIdsForManager(user.userId, [clientId]);
        if (!accessibleClientIds.includes(clientId)) throw new ForbiddenError('Forbidden');
      }

      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { lockDay: true },
      });
      if (!client) throw new NotFoundError('Client not found');
      lockDay = client.lockDay ?? lockDay;
    }

    const locked = isMonthLocked(year, month, lockDay);
    let temporaryUnlock = false;

    if (locked && clientId) {
      const entryDate = new Date(Date.UTC(year, month - 1, 1));
      temporaryUnlock = Boolean(await hasActiveTemporaryUnlock(user.userId, clientId, entryDate));
    }

    sendSuccess(res, 200, { locked, lockDay, temporaryUnlock });
  } catch (error) {
    respondFailure(res, error);
  }
};

export const batchLockStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireUser(req);
    const { clientIds, month, year } = req.body;

    if (!month || !year) throw new BadRequestError('Month and year are required');
    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      throw new BadRequestError('clientIds array is required');
    }
    if (clientIds.length > 50) {
      throw new BadRequestError('Maximum 50 clients allowed per batch request');
    }

    const normalizedClientIds = clientIds.map(Number);
    const cacheKey = `${CACHE_KEYS.LOCK_STATUS_BATCH}${user.userId}:${year}:${month}:${[...normalizedClientIds].sort((a, b) => a - b).join(',')}`;
    const cached =
      await cacheGet<Record<number, { locked: boolean; lockDay: number | null }>>(cacheKey);
    if (cached) {
      sendSuccess(res, 200, cached);
      return;
    }

    const accessibleClientIds =
      user.roleId === 1
        ? new Set<number>(normalizedClientIds)
        : user.roleId === 2
          ? new Set<number>(
              await getAccessibleClientIdsForManager(user.userId, normalizedClientIds)
            )
          : new Set<number>(
              await getAccessibleClientIdsForConsultant(user.userId, normalizedClientIds)
            );

    const clients = await prisma.client.findMany({
      where: { id: { in: Array.from(accessibleClientIds) } },
      select: { id: true, lockDay: true },
    });

    const clientLockDays = new Map(clients.map((client) => [client.id, client.lockDay]));
    const result: Record<number, { locked: boolean; lockDay: number | null }> = {};

    for (const clientId of normalizedClientIds) {
      if (!accessibleClientIds.has(clientId)) {
        result[clientId] = { locked: true, lockDay: null };
        continue;
      }

      const lockDay = clientLockDays.get(clientId) ?? config.timeEntryLockDay;
      result[clientId] = { locked: isMonthLocked(Number(year), Number(month), lockDay), lockDay };
    }

    await cacheSet(cacheKey, result, config.redis.cacheTtl.lockStatus);
    sendSuccess(res, 200, result);
  } catch (error) {
    respondFailure(res, error);
  }
};
