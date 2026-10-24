import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../../app/http/presenters/api.presenter.js';
import { BadRequestError, toAppError, UnauthorizedError } from '../../../app/errors/app-error.js';
import {
  getActiveTrackingSession,
  importTrackingSession,
  listOwnTrackingSessions,
  startTrackingSession,
  transitionTrackingSession,
} from '../application/tracking.service.js';

export const listTrackingSessionsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    sendSuccess(res, 200, await listOwnTrackingSessions(req.user.userId));
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const getActiveTrackingSessionController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    sendSuccess(res, 200, {
      session: await getActiveTrackingSession(req.user.userId),
    });
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const startTrackingSessionController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const timeEntryId =
      req.body?.timeEntryId == null ? null : Number(req.body.timeEntryId);
    if (timeEntryId != null && (!Number.isSafeInteger(timeEntryId) || timeEntryId <= 0)) {
      throw new BadRequestError('Invalid timeEntryId');
    }
    const session = await startTrackingSession({
      actorUserId: req.user.userId,
      timeEntryId,
    });
    sendSuccess(res, 201, session);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

const transition =
  (action: 'pause' | 'resume' | 'stop') =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError('Unauthorized');
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestError('Invalid id');
      const session = await transitionTrackingSession({
        sessionId: id,
        actorUserId: req.user.userId,
        action,
      });
      sendSuccess(res, 200, session);
    } catch (error) {
      sendError(res, toAppError(error));
    }
  };

export const pauseTrackingSessionController = transition('pause');
export const resumeTrackingSessionController = transition('resume');
export const stopTrackingSessionController = transition('stop');

const parseIsoDate = (value: unknown, field: string): Date => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(`${field} required`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestError(`Invalid ${field}`);
  return date;
};

/** Importa sessao STOPPED de rastreador externo; dedupe por externalId. */
export const importTrackingSessionController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const externalId = typeof req.body?.externalId === 'string' ? req.body.externalId : '';
    const timeEntryId =
      req.body?.timeEntryId == null ? null : Number(req.body.timeEntryId);
    if (timeEntryId != null && (!Number.isSafeInteger(timeEntryId) || timeEntryId <= 0)) {
      throw new BadRequestError('Invalid timeEntryId');
    }
    const accumulatedPausedMs =
      req.body?.accumulatedPausedMs == null ? undefined : Number(req.body.accumulatedPausedMs);
    if (
      accumulatedPausedMs != null &&
      (!Number.isFinite(accumulatedPausedMs) || accumulatedPausedMs < 0)
    ) {
      throw new BadRequestError('Invalid accumulatedPausedMs');
    }
    const result = await importTrackingSession({
      actorUserId: req.user.userId,
      externalId,
      startedAt: parseIsoDate(req.body?.startedAt, 'startedAt'),
      endedAt: parseIsoDate(req.body?.endedAt, 'endedAt'),
      timeEntryId,
      accumulatedPausedMs,
    });
    sendSuccess(res, result.created ? 201 : 200, {
      ...result.session,
      created: result.created,
      note: 'Imported STOPPED session (source IMPORT); never invents idle policy.',
    });
  } catch (error) {
    sendError(res, toAppError(error));
  }
};
