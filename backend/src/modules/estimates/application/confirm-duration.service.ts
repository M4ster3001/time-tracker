import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../app/errors/app-error.js';
import { applyDurationConfirmation } from '../domain/confirm-duration.js';
import { validateDurationMinutes } from '../../time-tracking/domain/services/time-entry-validation.service.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import { assertCanConfirmDurationForEntryOwners } from './confirm-duration-access.service.js';

export const confirmTimeEntryDuration = async (input: {
  timeEntryId: number;
  actorUserId: number;
  actorRoleId: number;
  confirmedMinutes: number;
  justification?: string | null;
}) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  const entry = await prisma.timeEntry.findFirst({
    where: { id: input.timeEntryId, deletedAt: null },
  });
  if (!entry) throw new NotFoundError('Time entry not found');

  // estimates.confirm scope: self / team(+managed) / all — nao roleId solta.
  await assertCanConfirmDurationForEntryOwners({
    actorUserId: input.actorUserId,
    entryOwnerUserIds: [entry.userId],
  });

  const previous = await prisma.durationConfirmation.findFirst({
    where: { timeEntryId: entry.id },
    orderBy: { version: 'desc' },
  });

  const latestEstimateRevision =
    entry.workActivityId == null
      ? null
      : await prisma.estimateRevision.findFirst({
          where: { workActivityId: entry.workActivityId },
          orderBy: { version: 'desc' },
        });

  let patch;
  try {
    validateDurationMinutes(Math.round(input.confirmedMinutes) || 0);
    patch = applyDurationConfirmation({
      durationMinutes: entry.durationMinutes,
      estimatedDurationMinutes: entry.estimatedDurationMinutes,
      confirmedDurationMinutes: entry.confirmedDurationMinutes,
      confirmedMinutes: input.confirmedMinutes,
      actorUserId: input.actorUserId,
      previousConfirmationId: previous?.id ?? null,
      previousConfirmationVersion: previous?.version ?? null,
      justification: input.justification,
    });
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const confirmation = await tx.durationConfirmation.create({
      data: {
        timeEntryId: entry.id,
        workActivityId: entry.workActivityId ?? null,
        estimateRevisionId: latestEstimateRevision?.id ?? null,
        version: patch.confirmationVersion,
        confirmedMinutes: patch.confirmedDurationMinutes,
        estimatedMinutesSnapshot: patch.estimatedDurationMinutes,
        justification: patch.justification,
        confirmedByUserId: patch.confirmedByUserId,
        confirmedAt: patch.confirmedAt,
        previousConfirmationId: patch.previousConfirmationId,
      },
    });

    const timeEntry = await tx.timeEntry.update({
      where: { id: entry.id },
      data: {
        estimatedDurationMinutes: patch.estimatedDurationMinutes,
        confirmedDurationMinutes: patch.confirmedDurationMinutes,
        durationMinutes: patch.durationMinutes,
        confirmedAt: patch.confirmedAt,
        confirmedByUserId: patch.confirmedByUserId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        endpoint: `/api/time-entries/${entry.id}/confirm-duration`,
        action: 'CONFIRM_DURATION',
        status: 'success',
        details: JSON.stringify({
          timeEntryId: entry.id,
          confirmationId: confirmation.id,
          confirmationVersion: confirmation.version,
          previousConfirmationId: patch.previousConfirmationId,
          fromDurationMinutes: entry.durationMinutes,
          estimatedDurationMinutes: entry.estimatedDurationMinutes,
          confirmedDurationMinutes: patch.confirmedDurationMinutes,
          justification: patch.justification,
        }).slice(0, 4000),
      },
    });

    return timeEntry;
  });

  return updated;
};
