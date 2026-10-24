import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { ForbiddenError, NotFoundError } from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import { buildTimeEntryEstimateHistory } from '../domain/estimate-history.js';

const assertCanReadEntry = (
  entry: { userId: number },
  actorUserId: number,
  actorRoleId: number
): void => {
  if (entry.userId !== actorUserId && actorRoleId !== 1 && actorRoleId !== 2) {
    throw new ForbiddenError('Forbidden');
  }
};

export const getTimeEntryEstimateHistory = async (input: {
  timeEntryId: number;
  actorUserId: number;
  actorRoleId: number;
}) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  const entry = await prisma.timeEntry.findFirst({
    where: { id: input.timeEntryId, deletedAt: null },
  });
  if (!entry) throw new NotFoundError('Time entry not found');
  assertCanReadEntry(entry, input.actorUserId, input.actorRoleId);

  const [confirmations, estimateRevisions, estimationReferences] = await Promise.all([
    prisma.durationConfirmation.findMany({
      where: { timeEntryId: entry.id },
      orderBy: { version: 'desc' },
    }),
    entry.workActivityId == null
      ? Promise.resolve([])
      : prisma.estimateRevision.findMany({
          where: { workActivityId: entry.workActivityId },
          orderBy: { version: 'desc' },
        }),
    prisma.estimationReference.findMany({
      where: { timeEntryId: entry.id },
      orderBy: { collectedAt: 'desc' },
    }),
  ]);

  return buildTimeEntryEstimateHistory({
    timeEntryId: entry.id,
    workActivityId: entry.workActivityId ?? null,
    actualTrackedDurationMinutes: entry.actualTrackedDurationMinutes,
    confirmations: confirmations.map((c) => ({
      id: c.id,
      uuid: c.uuid,
      version: c.version,
      confirmedMinutes: c.confirmedMinutes,
      estimatedMinutesSnapshot: c.estimatedMinutesSnapshot,
      justification: c.justification,
      confirmedByUserId: c.confirmedByUserId,
      confirmedAt: c.confirmedAt,
      previousConfirmationId: c.previousConfirmationId,
      estimateRevisionId: c.estimateRevisionId,
      workActivityId: c.workActivityId,
    })),
    estimateRevisions: estimateRevisions.map((r) => ({
      id: r.id,
      uuid: r.uuid,
      version: r.version,
      baseMinutes: r.baseMinutes,
      factor: Number(r.factor),
      rawMinutes: Number(r.rawMinutes),
      suggestedMinutes: r.suggestedMinutes,
      roundingMode: r.roundingMode,
      parameterRevisionUuid: r.parameterRevisionUuid,
      origin: r.origin,
      algorithmVersion: r.algorithmVersion,
      authorUserId: r.authorUserId,
      reason: r.reason,
      previousRevisionId: r.previousRevisionId,
      createdAt: r.createdAt,
    })),
    estimationReferences: estimationReferences.map((r) => ({
      id: r.id,
      uuid: r.uuid,
      provider: r.provider,
      kind: r.kind,
      externalId: r.externalId,
      repository: r.repository,
      title: r.title,
      uri: r.uri,
      collectedAt: r.collectedAt,
    })),
  });
};

export const listTimeEntryDurationConfirmations = async (input: {
  timeEntryId: number;
  actorUserId: number;
  actorRoleId: number;
}) => {
  const history = await getTimeEntryEstimateHistory(input);
  return {
    timeEntryId: history.timeEntryId,
    durationConfirmations: history.durationConfirmations,
  };
};

export const listTimeEntryEstimateRevisions = async (input: {
  timeEntryId: number;
  actorUserId: number;
  actorRoleId: number;
}) => {
  const history = await getTimeEntryEstimateHistory(input);
  return {
    timeEntryId: history.timeEntryId,
    workActivityId: history.workActivityId,
    estimateRevisions: history.estimateRevisions,
  };
};

export const listTimeEntryEstimationReferences = async (input: {
  timeEntryId: number;
  actorUserId: number;
  actorRoleId: number;
}) => {
  const history = await getTimeEntryEstimateHistory(input);
  return {
    timeEntryId: history.timeEntryId,
    estimationReferences: history.estimationReferences,
  };
};
