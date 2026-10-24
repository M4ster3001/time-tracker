import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import { computeEstimatePreview } from '../domain/estimate-preview.js';
import {
  applyEstimateRevision,
  createWorkActivityDraft,
  type EstimateRevisionOrigin,
} from '../domain/work-activity.js';
import { resolveActiveCatalogParameters } from './resolve-catalog-parameters.js';

export const createWorkActivity = async (input: {
  actorUserId: number;
  clientId: number;
  title: string;
  projectId?: number | null;
  description?: string | null;
  taskTypeCode?: string | null;
  timeEntryId?: number | null;
}) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  let draft;
  try {
    draft = createWorkActivityDraft({
      clientId: input.clientId,
      title: input.title,
      ownerUserId: input.actorUserId,
      projectId: input.projectId,
      description: input.description,
      taskTypeCode: input.taskTypeCode,
    });
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const client = await prisma.client.findFirst({
    where: { id: draft.clientId, deletedAt: null },
  });
  if (!client) throw new NotFoundError('Client not found');

  if (draft.projectId != null) {
    const project = await prisma.project.findFirst({
      where: { id: draft.projectId, clientId: draft.clientId },
    });
    if (!project) throw new BadRequestError('PROJECT_CLIENT_MISMATCH');
  }

  let taskTypeId: number | null = null;
  if (draft.taskTypeCode) {
    const taskType = await prisma.taskType.findUnique({ where: { code: draft.taskTypeCode } });
    if (!taskType) throw new BadRequestError('TASK_TYPE_NOT_FOUND');
    taskTypeId = taskType.id;
  }

  const activity = await prisma.workActivity.create({
    data: {
      clientId: draft.clientId,
      projectId: draft.projectId,
      title: draft.title,
      description: draft.description,
      taskTypeId,
      ownerUserId: draft.ownerUserId,
      state: draft.state,
      version: draft.version,
    },
  });

  if (input.timeEntryId != null) {
    const entry = await prisma.timeEntry.findFirst({
      where: { id: input.timeEntryId, deletedAt: null, userId: input.actorUserId },
    });
    if (!entry) throw new NotFoundError('Time entry not found');
    if (entry.clientId !== activity.clientId) {
      throw new BadRequestError('TIME_ENTRY_CLIENT_MISMATCH');
    }
    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { workActivityId: activity.id },
    });
  }

  return activity;
};

export const createEstimateRevisionForActivity = async (input: {
  actorUserId: number;
  workActivityId: number;
  baseMinutes?: number;
  factor?: number;
  origin?: EstimateRevisionOrigin;
  reason?: string | null;
  parameterRevisionUuid?: string | null;
  /** Default true: espelha suggestedMinutes em estimatedDurationMinutes dos apontamentos vinculados. */
  syncEstimatedOnLinkedEntries?: boolean;
}) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  const activity = await prisma.workActivity.findUnique({
    where: { id: input.workActivityId },
    include: { taskType: true },
  });
  if (!activity) throw new NotFoundError('Work activity not found');

  let baseMinutes = input.baseMinutes;
  let factor = input.factor;
  let parameterRevisionUuid = input.parameterRevisionUuid ?? null;

  if ((baseMinutes == null || factor == null) && activity.taskTypeId) {
    const catalog = await resolveActiveCatalogParameters({
      taskTypeId: activity.taskTypeId,
      context: { clientId: activity.clientId, projectId: activity.projectId },
    });
    if (catalog) {
      baseMinutes = baseMinutes ?? catalog.baseMinutes;
      factor = factor ?? catalog.factor;
      parameterRevisionUuid = parameterRevisionUuid ?? catalog.parameterRevisionUuid;
    }
  }

  if (baseMinutes == null || factor == null) {
    throw new BadRequestError('ESTIMATE_BASE_OR_FACTOR_REQUIRED');
  }

  const preview = computeEstimatePreview({ baseMinutes, factor });
  const previous = await prisma.estimateRevision.findFirst({
    where: { workActivityId: activity.id },
    orderBy: { version: 'desc' },
  });

  let draft;
  try {
    draft = applyEstimateRevision({
      workActivityId: activity.id,
      previousVersion: previous?.version ?? null,
      previousRevisionId: previous?.id ?? null,
      baseMinutes: preview.baseMinutes,
      factor: preview.factor,
      rawMinutes: preview.rawMinutes,
      suggestedMinutes: preview.suggestedMinutes,
      roundingMode: preview.roundingMode,
      parameterRevisionUuid,
      origin: input.origin ?? (parameterRevisionUuid ? 'CATALOG' : 'ONE_OFF'),
      authorUserId: input.actorUserId,
      reason: input.reason,
    });
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const revision = await prisma.estimateRevision.create({
    data: {
      workActivityId: draft.workActivityId,
      version: draft.version,
      baseMinutes: draft.baseMinutes,
      factor: draft.factor,
      rawMinutes: draft.rawMinutes,
      suggestedMinutes: draft.suggestedMinutes,
      roundingMode: draft.roundingMode,
      parameterRevisionUuid: draft.parameterRevisionUuid,
      origin: draft.origin,
      algorithmVersion: draft.algorithmVersion,
      authorUserId: draft.authorUserId,
      reason: draft.reason,
      previousRevisionId: draft.previousRevisionId,
    },
  });

  let syncedEntryCount = 0;
  if (input.syncEstimatedOnLinkedEntries !== false) {
    const updated = await prisma.timeEntry.updateMany({
      where: { workActivityId: activity.id, deletedAt: null },
      data: { estimatedDurationMinutes: draft.suggestedMinutes },
    });
    syncedEntryCount = updated.count;
  }

  return {
    activity,
    revision,
    mutatesCatalog: draft.mutatesCatalog,
    syncedEntryCount,
  };
};
