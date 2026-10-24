import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import {
  assertParameterScopeTargets,
  normalizeEstimationScope,
  type EstimationScopeKind,
} from '../domain/parameter-scope.js';
import {
  buildTaskTypeCreateDraft,
  buildTaskTypeParameterDraft,
  buildTaskTypeUpdateDraft,
} from '../domain/task-type.js';
import { buildParameterSetDeactivateDraft } from '../domain/parameter-set-deactivate.js';

const toPublicRow = (row: {
  id: number;
  uuid: string;
  code: string;
  namePt: string;
  nameEn: string;
  description: string | null;
  isActive: boolean;
  parameterSets?: Array<{
    revisions: Array<{ baseMinutes: number; factor: { toString(): string } | number }>;
  }>;
}) => {
  const revision = row.parameterSets?.[0]?.revisions?.[0];
  const factor =
    revision == null
      ? null
      : typeof revision.factor === 'number'
        ? revision.factor
        : Number(revision.factor.toString());
  return {
    id: row.id,
    uuid: row.uuid,
    code: row.code,
    namePt: row.namePt,
    nameEn: row.nameEn,
    description: row.description,
    isActive: row.isActive,
    activeBaseMinutes: revision?.baseMinutes ?? null,
    activeFactor: factor != null && Number.isFinite(factor) ? factor : null,
  };
};

const parameterInclude = {
  parameterSets: {
    where: { isActive: true, scope: 'GLOBAL' as const },
    take: 1,
    include: {
      revisions: {
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' as const },
        take: 1,
      },
    },
  },
};

export const listTaskTypes = async (input: { includeInactive?: boolean }) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  const rows = await prisma.taskType.findMany({
    where: input.includeInactive ? undefined : { isActive: true },
    orderBy: { code: 'asc' },
    include: parameterInclude,
  });
  return rows.map(toPublicRow);
};

export const createTaskType = async (input: {
  actorUserId: number;
  code: string;
  namePt: string;
  nameEn: string;
  description?: string | null;
  baseMinutes?: number | null;
  factor?: number | null;
  roundingMode?: string | null;
}) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  let draft;
  try {
    draft = buildTaskTypeCreateDraft(input);
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const existing = await prisma.taskType.findUnique({ where: { code: draft.code } });
  if (existing) throw new ConflictError('TASK_TYPE_CODE_EXISTS');

  const created = await prisma.$transaction(async (tx) => {
    const taskType = await tx.taskType.create({
      data: {
        code: draft.code,
        namePt: draft.namePt,
        nameEn: draft.nameEn,
        description: draft.description,
        isActive: draft.isActive,
      },
    });

    if (draft.initialParameters) {
      const set = await tx.estimationParameterSet.create({
        data: {
          taskTypeId: taskType.id,
          scope: 'GLOBAL',
          isActive: true,
        },
      });
      await tx.estimationParameterRevision.create({
        data: {
          parameterSetId: set.id,
          baseMinutes: draft.initialParameters.baseMinutes,
          factor: draft.initialParameters.factor,
          roundingMode: draft.initialParameters.roundingMode,
          effectiveFrom: new Date(),
          authorUserId: input.actorUserId,
          reason: 'Initial catalog parameters',
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        endpoint: '/api/task-types',
        action: 'TASK_TYPE_CREATE',
        status: 'success',
        details: JSON.stringify({
          taskTypeId: taskType.id,
          code: taskType.code,
          withParameters: Boolean(draft.initialParameters),
        }).slice(0, 4000),
      },
    });

    return taskType;
  });

  const full = await prisma.taskType.findUniqueOrThrow({
    where: { id: created.id },
    include: parameterInclude,
  });
  return toPublicRow(full);
};

export const updateTaskType = async (input: {
  actorUserId: number;
  id: number;
  namePt?: string | null;
  nameEn?: string | null;
  description?: string | null;
  isActive?: boolean | null;
}) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  if (!Number.isSafeInteger(input.id) || input.id <= 0) {
    throw new BadRequestError('Invalid id');
  }

  let draft;
  try {
    draft = buildTaskTypeUpdateDraft(input);
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const existing = await prisma.taskType.findUnique({ where: { id: input.id } });
  if (!existing) throw new NotFoundError('Task type not found');

  await prisma.$transaction(async (tx) => {
    await tx.taskType.update({
      where: { id: input.id },
      data: {
        ...(draft.namePt !== undefined ? { namePt: draft.namePt } : {}),
        ...(draft.nameEn !== undefined ? { nameEn: draft.nameEn } : {}),
        ...(draft.description !== undefined ? { description: draft.description } : {}),
        ...(draft.isActive !== undefined ? { isActive: draft.isActive } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        endpoint: `/api/task-types/${input.id}`,
        action: 'TASK_TYPE_UPDATE',
        status: 'success',
        details: JSON.stringify({ taskTypeId: input.id, ...draft }).slice(0, 4000),
      },
    });
  });

  const full = await prisma.taskType.findUniqueOrThrow({
    where: { id: input.id },
    include: parameterInclude,
  });
  return toPublicRow(full);
};

export type TaskTypeParameterSetPublic = {
  id: number;
  uuid: string;
  scope: EstimationScopeKind;
  clientId: number | null;
  projectId: number | null;
  isActive: boolean;
  activeBaseMinutes: number | null;
  activeFactor: number | null;
  activeRevisionUuid: string | null;
};

const toParameterSetPublic = (set: {
  id: number;
  uuid: string;
  scope: string;
  clientId: number | null;
  projectId: number | null;
  isActive: boolean;
  revisions: Array<{
    uuid: string;
    baseMinutes: number;
    factor: { toString(): string } | number;
  }>;
}): TaskTypeParameterSetPublic => {
  const revision = set.revisions[0];
  const factor =
    revision == null
      ? null
      : typeof revision.factor === 'number'
        ? revision.factor
        : Number(revision.factor.toString());
  const scope =
    set.scope === 'CLIENT' || set.scope === 'PROJECT' || set.scope === 'GLOBAL'
      ? set.scope
      : 'GLOBAL';
  return {
    id: set.id,
    uuid: set.uuid,
    scope,
    clientId: set.clientId,
    projectId: set.projectId,
    isActive: set.isActive,
    activeBaseMinutes: revision?.baseMinutes ?? null,
    activeFactor: factor != null && Number.isFinite(factor) ? factor : null,
    activeRevisionUuid: revision?.uuid ?? null,
  };
};

export const listTaskTypeParameterSets = async (input: { id: number }) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');
  if (!Number.isSafeInteger(input.id) || input.id <= 0) {
    throw new BadRequestError('Invalid id');
  }

  const taskType = await prisma.taskType.findUnique({ where: { id: input.id } });
  if (!taskType) throw new NotFoundError('Task type not found');

  const sets = await prisma.estimationParameterSet.findMany({
    where: { taskTypeId: input.id, isActive: true },
    orderBy: [{ scope: 'asc' }, { clientId: 'asc' }, { projectId: 'asc' }],
    include: {
      revisions: {
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  });
  return sets.map(toParameterSetPublic);
};

/** Compat: GLOBAL por omissão; aceita CLIENT/PROJECT com alvos (plano §4.1–4.2). */
export const replaceTaskTypeGlobalParameters = async (input: {
  actorUserId: number;
  id: number;
  baseMinutes: number;
  factor: number;
  roundingMode?: string | null;
  reason?: string | null;
  scope?: string | null;
  clientId?: number | null;
  projectId?: number | null;
}) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  if (!Number.isSafeInteger(input.id) || input.id <= 0) {
    throw new BadRequestError('Invalid id');
  }

  let scopeKind: EstimationScopeKind;
  let targets: { scope: EstimationScopeKind; clientId: number | null; projectId: number | null };
  let parameters;
  try {
    scopeKind = normalizeEstimationScope(input.scope ?? 'GLOBAL');
    targets = assertParameterScopeTargets({
      scope: scopeKind,
      clientId: input.clientId,
      projectId: input.projectId,
    });
    parameters = buildTaskTypeParameterDraft({
      baseMinutes: input.baseMinutes,
      factor: input.factor,
      roundingMode: input.roundingMode,
    });
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const taskType = await prisma.taskType.findUnique({ where: { id: input.id } });
  if (!taskType) throw new NotFoundError('Task type not found');

  if (targets.scope === 'CLIENT' || targets.scope === 'PROJECT') {
    const client = await prisma.client.findUnique({ where: { id: targets.clientId! } });
    if (!client) throw new BadRequestError('PARAMETER_SCOPE_CLIENT_NOT_FOUND');
  }
  if (targets.scope === 'PROJECT') {
    const project = await prisma.project.findUnique({ where: { id: targets.projectId! } });
    if (!project) throw new BadRequestError('PARAMETER_SCOPE_PROJECT_NOT_FOUND');
    if (project.clientId !== targets.clientId) {
      throw new BadRequestError('PARAMETER_SCOPE_PROJECT_CLIENT_MISMATCH');
    }
  }

  const effectiveFrom = new Date();

  await prisma.$transaction(async (tx) => {
    let set = await tx.estimationParameterSet.findFirst({
      where: {
        taskTypeId: input.id,
        scope: targets.scope,
        isActive: true,
        clientId: targets.clientId,
        projectId: targets.projectId,
      },
    });
    if (!set) {
      set = await tx.estimationParameterSet.create({
        data: {
          taskTypeId: input.id,
          scope: targets.scope,
          clientId: targets.clientId,
          projectId: targets.projectId,
          isActive: true,
        },
      });
    }

    const current = await tx.estimationParameterRevision.findFirst({
      where: { parameterSetId: set.id, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (current) {
      await tx.estimationParameterRevision.update({
        where: { id: current.id },
        data: { effectiveTo: effectiveFrom },
      });
    }

    await tx.estimationParameterRevision.create({
      data: {
        parameterSetId: set.id,
        baseMinutes: parameters.baseMinutes,
        factor: parameters.factor,
        roundingMode: parameters.roundingMode,
        effectiveFrom,
        authorUserId: input.actorUserId,
        reason: input.reason?.trim() || 'Manual catalog parameter revision',
        previousRevisionId: current?.id ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        endpoint: `/api/task-types/${input.id}/parameters`,
        action: 'TASK_TYPE_PARAMETERS_REVISE',
        status: 'success',
        details: JSON.stringify({
          taskTypeId: input.id,
          scope: targets.scope,
          clientId: targets.clientId,
          projectId: targets.projectId,
          baseMinutes: parameters.baseMinutes,
          factor: parameters.factor,
          previousRevisionId: current?.id ?? null,
        }).slice(0, 4000),
      },
    });
  });

  const full = await prisma.taskType.findUniqueOrThrow({
    where: { id: input.id },
    include: parameterInclude,
  });
  return {
    ...toPublicRow(full),
    revisedScope: targets.scope,
    revisedClientId: targets.clientId,
    revisedProjectId: targets.projectId,
  };
};

/** Soft-deactivate CLIENT/PROJECT/GLOBAL sets; revisions remain for history/calibration. */
export const deactivateTaskTypeParameterSet = async (input: {
  actorUserId: number;
  taskTypeId: number;
  setId: number;
}): Promise<TaskTypeParameterSetPublic> => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  if (
    !Number.isSafeInteger(input.taskTypeId) ||
    input.taskTypeId <= 0 ||
    !Number.isSafeInteger(input.setId) ||
    input.setId <= 0
  ) {
    throw new BadRequestError('Invalid id');
  }

  const set = await prisma.estimationParameterSet.findFirst({
    where: { id: input.setId, taskTypeId: input.taskTypeId },
    include: {
      revisions: {
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  });
  if (!set) throw new NotFoundError('Parameter set not found');

  let draft;
  try {
    draft = buildParameterSetDeactivateDraft({
      id: set.id,
      isActive: set.isActive,
      scope: set.scope,
    });
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.estimationParameterSet.update({
      where: { id: draft.id },
      data: { isActive: draft.isActive },
      include: {
        revisions: {
          where: { effectiveTo: null },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });
    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        endpoint: `/api/task-types/${input.taskTypeId}/parameter-sets/${input.setId}/deactivate`,
        action: 'TASK_TYPE_PARAMETER_SET_DEACTIVATE',
        status: 'success',
        details: JSON.stringify({
          taskTypeId: input.taskTypeId,
          parameterSetId: input.setId,
          scope: set.scope,
          clientId: set.clientId,
          projectId: set.projectId,
        }).slice(0, 4000),
      },
    });
    return row;
  });

  return toParameterSetPublic(updated);
};
