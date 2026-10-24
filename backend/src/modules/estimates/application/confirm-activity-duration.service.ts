import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import {
  planActivityConfirmationDistribution,
  type ActivityConfirmationPlan,
} from '../domain/confirm-duration-distribution.js';
import { resolveConfirmableActivityEntries } from './confirm-duration-access.service.js';

const weightForEntry = (entry: {
  durationMinutes: number;
  estimatedDurationMinutes: number | null;
}): number => {
  if (entry.durationMinutes > 0) return entry.durationMinutes;
  if (entry.estimatedDurationMinutes != null && entry.estimatedDurationMinutes > 0) {
    return entry.estimatedDurationMinutes;
  }
  return 1;
};

const buildActivityConfirmationPlan = async (input: {
  workActivityId: number;
  actorUserId: number;
  actorRoleId: number;
  confirmedMinutes: number;
  justification?: string | null;
  distribution?: { timeEntryId: number; confirmedMinutes: number }[] | null;
}): Promise<{
  plan: ActivityConfirmationPlan;
  estimateRevisionId: number | null;
  partial: boolean;
  skippedTimeEntryIds: number[];
}> => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  const activity = await prisma.workActivity.findUnique({ where: { id: input.workActivityId } });
  if (!activity) throw new NotFoundError('Work activity not found');

  const entries = await prisma.timeEntry.findMany({
    where: { workActivityId: activity.id, deletedAt: null },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
  if (entries.length === 0) throw new BadRequestError('DISTRIBUTION_EMPTY');

  // Multi-user: confirma so o subconjunto autorizado (self/team); nao exige todos.
  // WorkActivity.ownerUserId nao autoriza confirmar horas de outrem.
  const partition = await resolveConfirmableActivityEntries({
    actorUserId: input.actorUserId,
    entries,
  });
  const confirmableEntries = partition.confirmable;
  const skippedTimeEntryIds = partition.skipped.map((entry) => entry.id);

  if (input.distribution != null) {
    const confirmableIds = new Set(confirmableEntries.map((e) => e.id));
    for (const row of input.distribution) {
      if (!confirmableIds.has(row.timeEntryId)) {
        throw new BadRequestError('DISTRIBUTION_ENTRY_NOT_CONFIRMABLE');
      }
    }
  }

  const previousByEntry = await Promise.all(
    confirmableEntries.map(async (entry) => {
      const previous = await prisma.durationConfirmation.findFirst({
        where: { timeEntryId: entry.id },
        orderBy: { version: 'desc' },
      });
      return { timeEntryId: entry.id, previous };
    })
  );
  const previousMap = new Map(previousByEntry.map((row) => [row.timeEntryId, row.previous]));

  const latestEstimateRevision = await prisma.estimateRevision.findFirst({
    where: { workActivityId: activity.id },
    orderBy: { version: 'desc' },
  });

  try {
    const plan = planActivityConfirmationDistribution({
      totalConfirmedMinutes: input.confirmedMinutes,
      actorUserId: input.actorUserId,
      justification: input.justification,
      explicit: input.distribution ?? null,
      entries: confirmableEntries.map((entry) => {
        const previous = previousMap.get(entry.id) ?? null;
        return {
          timeEntryId: entry.id,
          durationMinutes: entry.durationMinutes,
          weightMinutes: weightForEntry(entry),
          estimatedDurationMinutes: entry.estimatedDurationMinutes,
          previousConfirmationId: previous?.id ?? null,
          previousConfirmationVersion: previous?.version ?? null,
        };
      }),
    });
    return {
      plan,
      estimateRevisionId: latestEstimateRevision?.id ?? null,
      partial: partition.partial,
      skippedTimeEntryIds,
    };
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }
};

export const previewWorkActivityConfirmation = async (input: {
  workActivityId: number;
  actorUserId: number;
  actorRoleId: number;
  confirmedMinutes: number;
  distribution?: { timeEntryId: number; confirmedMinutes: number }[] | null;
}) => {
  const { plan, partial, skippedTimeEntryIds } = await buildActivityConfirmationPlan(input);
  return {
    workActivityId: input.workActivityId,
    totalConfirmedMinutes: plan.totalConfirmedMinutes,
    partial,
    skippedTimeEntryIds,
    distribution: plan.items.map((item) => ({
      timeEntryId: item.timeEntryId,
      confirmedMinutes: item.confirmedDurationMinutes,
      estimatedMinutesSnapshot: item.estimatedDurationMinutes,
      confirmationVersion: item.confirmationVersion,
      previousConfirmationId: item.previousConfirmationId,
    })),
  };
};

export const confirmWorkActivityDuration = async (input: {
  workActivityId: number;
  actorUserId: number;
  actorRoleId: number;
  confirmedMinutes: number;
  justification?: string | null;
  distribution?: { timeEntryId: number; confirmedMinutes: number }[] | null;
}) => {
  const { plan, estimateRevisionId, partial, skippedTimeEntryIds } =
    await buildActivityConfirmationPlan(input);

  const confirmations = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const item of plan.items) {
      const confirmation = await tx.durationConfirmation.create({
        data: {
          timeEntryId: item.timeEntryId,
          workActivityId: input.workActivityId,
          estimateRevisionId,
          version: item.confirmationVersion,
          confirmedMinutes: item.confirmedDurationMinutes,
          estimatedMinutesSnapshot: item.estimatedDurationMinutes,
          justification: item.justification,
          confirmedByUserId: item.confirmedByUserId,
          confirmedAt: item.confirmedAt,
          previousConfirmationId: item.previousConfirmationId,
        },
      });

      await tx.timeEntry.update({
        where: { id: item.timeEntryId },
        data: {
          estimatedDurationMinutes: item.estimatedDurationMinutes,
          confirmedDurationMinutes: item.confirmedDurationMinutes,
          durationMinutes: item.durationMinutes,
          confirmedAt: item.confirmedAt,
          confirmedByUserId: item.confirmedByUserId,
        },
      });

      created.push({
        confirmationId: confirmation.id,
        timeEntryId: item.timeEntryId,
        version: confirmation.version,
        confirmedMinutes: item.confirmedDurationMinutes,
        estimatedMinutesSnapshot: item.estimatedDurationMinutes,
        previousConfirmationId: item.previousConfirmationId,
      });
    }

    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        endpoint: `/api/work-activities/${input.workActivityId}/confirm-duration`,
        action: 'CONFIRM_ACTIVITY_DURATION',
        status: 'success',
        details: JSON.stringify({
          workActivityId: input.workActivityId,
          totalConfirmedMinutes: plan.totalConfirmedMinutes,
          estimateRevisionId,
          justification: input.justification ?? null,
          partial,
          skippedTimeEntryIds,
          confirmations: created,
        }).slice(0, 4000),
      },
    });

    return created;
  });

  return {
    workActivityId: input.workActivityId,
    totalConfirmedMinutes: plan.totalConfirmedMinutes,
    partial,
    skippedTimeEntryIds,
    confirmations,
  };
};
