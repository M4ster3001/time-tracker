import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import {
  applyTrackingSessionTransition,
  buildImportedTrackingSession,
  computeActualTrackedFromSessions,
  resolveImportIdempotency,
  type TrackingSessionAction,
} from '../domain/tracking-session.js';

const requireTrackingFlow = async (): Promise<void> => {
  const flows = await getFlows();
  if (!flows.tracking) throw new ForbiddenError('FLOW_DISABLED');
};

const mapSession = (row: {
  id: number;
  userId: number;
  timeEntryId: number | null;
  state: string;
  startedAt: Date;
  endedAt: Date | null;
  pausedAt: Date | null;
  accumulatedPausedMs: number;
  source: string;
  externalId: string | null;
}) => ({
  id: row.id,
  userId: row.userId,
  timeEntryId: row.timeEntryId,
  state: row.state as 'RUNNING' | 'PAUSED' | 'STOPPED',
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  pausedAt: row.pausedAt,
  accumulatedPausedMs: row.accumulatedPausedMs,
  source: row.source as 'TIMER' | 'IMPORT',
  externalId: row.externalId,
});

const syncActualTrackedOnEntry = async (timeEntryId: number | null | undefined): Promise<void> => {
  if (timeEntryId == null) return;
  const sessions = await prisma.trackingSession.findMany({
    where: { timeEntryId },
  });
  const actual = computeActualTrackedFromSessions(
    sessions.map((s) => ({
      state: s.state as 'RUNNING' | 'PAUSED' | 'STOPPED',
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      accumulatedPausedMs: s.accumulatedPausedMs,
    }))
  );
  await prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: { actualTrackedDurationMinutes: actual },
  });
};

export const startTrackingSession = async (input: {
  actorUserId: number;
  timeEntryId?: number | null;
}) => {
  await requireTrackingFlow();

  if (input.timeEntryId != null) {
    const entry = await prisma.timeEntry.findFirst({
      where: { id: input.timeEntryId, deletedAt: null, userId: input.actorUserId },
    });
    if (!entry) throw new NotFoundError('Time entry not found');
  }

  const open = await prisma.trackingSession.findFirst({
    where: {
      userId: input.actorUserId,
      state: { in: ['RUNNING', 'PAUSED'] },
    },
  });
  if (open) throw new BadRequestError('TRACKING_SESSION_ALREADY_OPEN');

  let snapshot;
  try {
    snapshot = applyTrackingSessionTransition({
      action: 'start',
      session: null,
      userId: input.actorUserId,
      timeEntryId: input.timeEntryId ?? null,
      at: new Date(),
    });
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  return prisma.trackingSession.create({
    data: {
      userId: snapshot.userId,
      timeEntryId: snapshot.timeEntryId,
      state: snapshot.state,
      source: snapshot.source,
      startedAt: snapshot.startedAt,
      endedAt: snapshot.endedAt,
      pausedAt: snapshot.pausedAt,
      accumulatedPausedMs: snapshot.accumulatedPausedMs,
      externalId: snapshot.externalId,
    },
  });
};

export const transitionTrackingSession = async (input: {
  sessionId: number;
  actorUserId: number;
  action: Exclude<TrackingSessionAction, 'start'>;
}) => {
  await requireTrackingFlow();

  const row = await prisma.trackingSession.findFirst({
    where: { id: input.sessionId, userId: input.actorUserId },
  });
  if (!row) throw new NotFoundError('Tracking session not found');

  let next;
  try {
    next = applyTrackingSessionTransition({
      action: input.action,
      session: mapSession(row),
      at: new Date(),
    });
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const updated = await prisma.trackingSession.update({
    where: { id: row.id },
    data: {
      state: next.state,
      endedAt: next.endedAt,
      pausedAt: next.pausedAt,
      accumulatedPausedMs: next.accumulatedPausedMs,
    },
  });

  if (input.action === 'stop') {
    await syncActualTrackedOnEntry(updated.timeEntryId);
  }

  return updated;
};

export const listOwnTrackingSessions = async (actorUserId: number) => {
  await requireTrackingFlow();
  return prisma.trackingSession.findMany({
    where: { userId: actorUserId },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
};

/** Sessao aberta (RUNNING/PAUSED) do ator — para o portal consultar estado do timer. */
export const getActiveTrackingSession = async (actorUserId: number) => {
  await requireTrackingFlow();
  return prisma.trackingSession.findFirst({
    where: {
      userId: actorUserId,
      state: { in: ['RUNNING', 'PAUSED'] },
    },
    orderBy: { startedAt: 'desc' },
  });
};

/**
 * Importa intervalo STOPPED de rastreador externo (source IMPORT).
 * Dedupe por unique(source, externalId); reenvio do mesmo ator e idempotente.
 * Flow `tracking` permanece off por default — exige opt-in + tracking.write.
 */
export const importTrackingSession = async (input: {
  actorUserId: number;
  externalId: string;
  startedAt: Date;
  endedAt: Date;
  timeEntryId?: number | null;
  accumulatedPausedMs?: number;
}): Promise<{ session: Awaited<ReturnType<typeof prisma.trackingSession.create>>; created: boolean }> => {
  await requireTrackingFlow();

  let snapshot;
  try {
    snapshot = buildImportedTrackingSession({
      userId: input.actorUserId,
      timeEntryId: input.timeEntryId ?? null,
      externalId: input.externalId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      accumulatedPausedMs: input.accumulatedPausedMs,
    });
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const existing = await prisma.trackingSession.findFirst({
    where: { source: 'IMPORT', externalId: snapshot.externalId },
  });
  const decision = resolveImportIdempotency(
    existing ? { userId: existing.userId } : null,
    { userId: snapshot.userId }
  );
  if (decision === 'conflict') {
    throw new ConflictError('TRACKING_EXTERNAL_ID_CONFLICT');
  }
  if (decision === 'reuse' && existing) {
    return { session: existing, created: false };
  }

  if (snapshot.timeEntryId != null) {
    const entry = await prisma.timeEntry.findFirst({
      where: { id: snapshot.timeEntryId, deletedAt: null, userId: input.actorUserId },
    });
    if (!entry) throw new NotFoundError('Time entry not found');
  }

  const session = await prisma.trackingSession.create({
    data: {
      userId: snapshot.userId,
      timeEntryId: snapshot.timeEntryId,
      state: snapshot.state,
      source: snapshot.source,
      startedAt: snapshot.startedAt,
      endedAt: snapshot.endedAt,
      pausedAt: snapshot.pausedAt,
      accumulatedPausedMs: snapshot.accumulatedPausedMs,
      externalId: snapshot.externalId,
    },
  });

  await syncActualTrackedOnEntry(session.timeEntryId);
  return { session, created: true };
};
