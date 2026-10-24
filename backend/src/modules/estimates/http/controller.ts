import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../../app/http/presenters/api.presenter.js';
import { BadRequestError, toAppError, UnauthorizedError } from '../../../app/errors/app-error.js';
import { computeEstimatePreview, type RoundingMode } from '../domain/estimate-preview.js';
import { confirmTimeEntryDuration } from '../application/confirm-duration.service.js';
import {
  confirmWorkActivityDuration,
  previewWorkActivityConfirmation,
} from '../application/confirm-activity-duration.service.js';
import { linkEstimationReference } from '../application/estimation-reference.service.js';
import { buildLocalGitCommitReferenceInput } from '../domain/estimation-reference-version.js';
import { previewCalibrationComparison } from '../application/calibration.service.js';
import { approveOrRejectCalibrationProposal } from '../application/calibration-approval.service.js';
import type {
  CalibrationExclusionReason,
  CalibrationSampleRowWithExclusion,
} from '../domain/calibration-exclusions.js';
import {
  getCalibrationThresholdConfig,
  saveCalibrationThresholdConfig,
} from '../application/calibration-policy.service.js';
import {
  createEstimateRevisionForActivity,
  createWorkActivity,
} from '../application/work-activity.service.js';
import { resolveActiveCatalogParameters } from '../application/resolve-catalog-parameters.js';
import {
  createTaskType,
  deactivateTaskTypeParameterSet,
  listTaskTypeParameterSets,
  listTaskTypes,
  replaceTaskTypeGlobalParameters,
  updateTaskType,
} from '../application/task-type.service.js';
import {
  getTimeEntryEstimateHistory,
  listTimeEntryDurationConfirmations,
  listTimeEntryEstimateRevisions,
  listTimeEntryEstimationReferences,
} from '../application/estimate-history.service.js';
import { withDurationContract } from '../../../shared/domain/duration-contract.js';
import { parseDurationMinutes } from '../../../shared/domain/duration.js';
import type { EstimationReferenceKind } from '../domain/estimation-reference.js';
import type { EstimateRevisionOrigin } from '../domain/work-activity.js';

export const previewEstimateController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const baseMinutes = Number(req.body?.baseMinutes);
    const factor = Number(req.body?.factor);
    const roundingMode = (req.body?.roundingMode as RoundingMode | undefined) ?? 'NEAREST_MINUTE';
    const taskTypeCode =
      typeof req.body?.taskTypeCode === 'string' ? req.body.taskTypeCode.trim() : '';
    const clientId =
      req.body?.clientId == null || req.body?.clientId === ''
        ? null
        : Number(req.body.clientId);
    const projectId =
      req.body?.projectId == null || req.body?.projectId === ''
        ? null
        : Number(req.body.projectId);

    let resolvedBase = baseMinutes;
    let resolvedFactor = factor;
    let revisionUuid: string | null = null;
    let resolvedScope: string | null = null;

    if (taskTypeCode) {
      const catalog = await resolveActiveCatalogParameters({
        taskTypeCode,
        context: { clientId, projectId },
      });
      if (catalog) {
        resolvedBase = catalog.baseMinutes;
        resolvedFactor = catalog.factor;
        revisionUuid = catalog.parameterRevisionUuid;
        resolvedScope = catalog.scope;
      }
    }

    try {
      const preview = computeEstimatePreview({
        baseMinutes: resolvedBase,
        factor: resolvedFactor,
        roundingMode,
      });
      sendSuccess(res, 200, {
        ...preview,
        parameterRevisionUuid: revisionUuid,
        parameterScope: resolvedScope,
      });
    } catch (error) {
      if (error instanceof Error) throw new BadRequestError(error.message);
      throw error;
    }
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const listTaskTypesController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const includeInactive =
      req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const rows = await listTaskTypes({ includeInactive });
    sendSuccess(res, 200, rows);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const createTaskTypeController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const row = await createTaskType({
      actorUserId: req.user.userId,
      code: String(req.body?.code ?? ''),
      namePt: String(req.body?.namePt ?? ''),
      nameEn: String(req.body?.nameEn ?? ''),
      description: req.body?.description == null ? null : String(req.body.description),
      baseMinutes: req.body?.baseMinutes == null ? null : Number(req.body.baseMinutes),
      factor: req.body?.factor == null ? null : Number(req.body.factor),
      roundingMode: req.body?.roundingMode == null ? null : String(req.body.roundingMode),
    });
    sendSuccess(res, 201, row);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const updateTaskTypeController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const id = Number(req.params.id);
    const row = await updateTaskType({
      actorUserId: req.user.userId,
      id,
      namePt: req.body?.namePt == null ? undefined : String(req.body.namePt),
      nameEn: req.body?.nameEn == null ? undefined : String(req.body.nameEn),
      description: req.body?.description === undefined ? undefined : req.body.description,
      isActive: req.body?.isActive === undefined ? undefined : Boolean(req.body.isActive),
    });
    sendSuccess(res, 200, row);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const listTaskTypeParameterSetsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const id = Number(req.params.id);
    const rows = await listTaskTypeParameterSets({ id });
    sendSuccess(res, 200, rows);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const replaceTaskTypeParametersController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const id = Number(req.params.id);
    const row = await replaceTaskTypeGlobalParameters({
      actorUserId: req.user.userId,
      id,
      baseMinutes: Number(req.body?.baseMinutes),
      factor: Number(req.body?.factor),
      roundingMode: req.body?.roundingMode == null ? null : String(req.body.roundingMode),
      reason: req.body?.reason == null ? null : String(req.body.reason),
      scope: req.body?.scope == null ? 'GLOBAL' : String(req.body.scope),
      clientId: req.body?.clientId == null ? null : Number(req.body.clientId),
      projectId: req.body?.projectId == null ? null : Number(req.body.projectId),
    });
    sendSuccess(res, 200, row);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const deactivateTaskTypeParameterSetController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const taskTypeId = Number(req.params.id);
    const setId = Number(req.params.setId);
    const row = await deactivateTaskTypeParameterSet({
      actorUserId: req.user.userId,
      taskTypeId,
      setId,
    });
    sendSuccess(res, 200, row);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const previewWorkActivityConfirmDurationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const workActivityId = Number(req.params.id);
    if (!Number.isSafeInteger(workActivityId) || workActivityId <= 0) {
      throw new BadRequestError('Invalid id');
    }
    const confirmedMinutes = Number(req.query.confirmedMinutes ?? req.body?.confirmedMinutes);
    if (!Number.isFinite(confirmedMinutes)) {
      throw new BadRequestError('confirmedMinutes is required');
    }
    const result = await previewWorkActivityConfirmation({
      workActivityId,
      actorUserId: req.user.userId,
      actorRoleId: req.user.roleId,
      confirmedMinutes,
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const confirmWorkActivityDurationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const workActivityId = Number(req.params.id);
    if (!Number.isSafeInteger(workActivityId) || workActivityId <= 0) {
      throw new BadRequestError('Invalid id');
    }
    const confirmedMinutes = Number(
      req.body?.confirmedMinutes ?? req.body?.durationMinutes ?? NaN
    );
    if (!Number.isFinite(confirmedMinutes)) {
      throw new BadRequestError('confirmedMinutes is required');
    }
    const distribution = Array.isArray(req.body?.distribution)
      ? (req.body.distribution as { timeEntryId: number; confirmedMinutes: number }[]).map(
          (row) => ({
            timeEntryId: Number(row.timeEntryId),
            confirmedMinutes: Number(row.confirmedMinutes),
          })
        )
      : null;
    const result = await confirmWorkActivityDuration({
      workActivityId,
      actorUserId: req.user.userId,
      actorRoleId: req.user.roleId,
      confirmedMinutes,
      justification:
        req.body?.justification == null ? null : String(req.body.justification).slice(0, 2000),
      distribution,
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const confirmDurationController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestError('Invalid id');
    const parsed = parseDurationMinutes(req.body?.confirmedMinutes ?? req.body?.durationMinutes);
    if (parsed === null) throw new BadRequestError('confirmedMinutes is required');
    const updated = await confirmTimeEntryDuration({
      timeEntryId: id,
      actorUserId: req.user.userId,
      actorRoleId: req.user.roleId,
      confirmedMinutes: parsed,
      justification:
        req.body?.justification == null ? null : String(req.body.justification).slice(0, 2000),
    });
    sendSuccess(res, 200, withDurationContract(updated));
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

const REFERENCE_KINDS = new Set([
  'COMMIT',
  'PULL_REQUEST',
  'ISSUE',
  'DOCUMENT',
  'MANUAL',
]);

export const linkEstimationReferenceController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const kind = String(req.body?.kind ?? '').toUpperCase();
    if (!REFERENCE_KINDS.has(kind)) throw new BadRequestError('Invalid kind');
    const provider = String(req.body?.provider ?? '').trim();
    const externalId = String(req.body?.externalId ?? '').trim();
    if (!provider || !externalId) throw new BadRequestError('provider and externalId required');
    const ref = await linkEstimationReference({
      actorUserId: req.user.userId,
      provider,
      kind: kind as EstimationReferenceKind,
      externalId,
      repository: req.body?.repository == null ? null : String(req.body.repository),
      title: req.body?.title == null ? null : String(req.body.title).slice(0, 500),
      uri: req.body?.uri == null ? null : String(req.body.uri).slice(0, 1000),
      timeEntryId: req.body?.timeEntryId == null ? null : Number(req.body.timeEntryId),
      projectId: req.body?.projectId == null ? null : Number(req.body.projectId),
      presentAsActualTracked: req.body?.presentAsActualTracked === true,
    });
    sendSuccess(res, 201, {
      ...ref,
      note: 'EstimationReference is evidence input only — not Actual Tracked Duration',
    });
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

/** SRC-01: aceita metadados de commit local (sem host/IdP); nunca Actual Tracked. */
export const linkLocalGitCommitReferenceController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    let mapped;
    try {
      mapped = buildLocalGitCommitReferenceInput({
        sha: String(req.body?.sha ?? ''),
        message: String(req.body?.message ?? ''),
        repository: String(req.body?.repository ?? ''),
        authorEmail:
          req.body?.authorEmail == null ? null : String(req.body.authorEmail),
        authorName: req.body?.authorName == null ? null : String(req.body.authorName),
      });
    } catch (error) {
      if (error instanceof Error) throw new BadRequestError(error.message);
      throw error;
    }
    const ref = await linkEstimationReference({
      actorUserId: req.user.userId,
      provider: mapped.provider,
      kind: mapped.kind,
      externalId: mapped.externalId,
      repository: mapped.repository,
      title: mapped.title,
      gitAuthorEmail: mapped.authorEmail,
      timeEntryId: req.body?.timeEntryId == null ? null : Number(req.body.timeEntryId),
      projectId: req.body?.projectId == null ? null : Number(req.body.projectId),
      presentAsActualTracked: false,
    });
    sendSuccess(res, 201, {
      ...ref,
      isActualTrackedEvidence: false,
      gitAuthorEmail: mapped.authorEmail,
      gitAuthorName: mapped.authorName,
      note:
        'local-git metadata only — not Actual Tracked Duration; authorUserId only when git email maps (verified/self-claim)',
    });
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const previewCalibrationController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const rows = Array.isArray(req.body?.rows)
      ? (req.body.rows as CalibrationSampleRowWithExclusion[])
      : undefined;
    const keepExclusionReasons = Array.isArray(req.body?.keepExclusionReasons)
      ? (req.body.keepExclusionReasons as CalibrationExclusionReason[])
      : undefined;
    const result = await previewCalibrationComparison({
      actorUserId: req.user.userId,
      rows,
      keepExclusionReasons,
      taskTypeCode: req.body?.taskTypeCode == null ? null : String(req.body.taskTypeCode),
      parameterSetId: req.body?.parameterSetId == null ? null : Number(req.body.parameterSetId),
      targetClientId:
        req.body?.targetClientId == null || req.body?.targetClientId === ''
          ? null
          : Number(req.body.targetClientId),
      targetProjectId:
        req.body?.targetProjectId == null || req.body?.targetProjectId === ''
          ? null
          : Number(req.body.targetProjectId),
      proposedBaseMinutes:
        req.body?.proposedBaseMinutes == null ? null : Number(req.body.proposedBaseMinutes),
      proposedFactor: req.body?.proposedFactor == null ? null : Number(req.body.proposedFactor),
      justification:
        req.body?.justification == null ? null : String(req.body.justification).slice(0, 2000),
      persistDraft: req.body?.persistDraft === true,
      markProposed: req.body?.markProposed === true,
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const decideCalibrationController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestError('Invalid id');
    const decision = String(req.body?.decision ?? '').toUpperCase();
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      throw new BadRequestError('decision must be APPROVE or REJECT');
    }
    const result = await approveOrRejectCalibrationProposal({
      proposalId: id,
      actorUserId: req.user.userId,
      decision: decision as 'APPROVE' | 'REJECT',
      justification:
        req.body?.justification == null ? null : String(req.body.justification).slice(0, 2000),
      effectiveFrom: req.body?.effectiveFrom ? new Date(String(req.body.effectiveFrom)) : undefined,
      targetClientId:
        req.body?.targetClientId === undefined
          ? undefined
          : req.body?.targetClientId == null || req.body?.targetClientId === ''
            ? null
            : Number(req.body.targetClientId),
      targetProjectId:
        req.body?.targetProjectId === undefined
          ? undefined
          : req.body?.targetProjectId == null || req.body?.targetProjectId === ''
            ? null
            : Number(req.body.targetProjectId),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const getCalibrationPolicyController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    sendSuccess(res, 200, {
      thresholds: await getCalibrationThresholdConfig(),
      note: 'Null fields mean the gate is off until product publishes pilot numbers.',
    });
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const putCalibrationPolicyController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const thresholds = await saveCalibrationThresholdConfig({
      actorUserId: req.user.userId,
      config: req.body?.thresholds ?? req.body,
    });
    sendSuccess(res, 200, { thresholds });
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const createWorkActivityController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const clientId = Number(req.body?.clientId);
    if (!Number.isSafeInteger(clientId) || clientId <= 0) {
      throw new BadRequestError('clientId is required');
    }
    const activity = await createWorkActivity({
      actorUserId: req.user.userId,
      clientId,
      title: String(req.body?.title ?? ''),
      projectId: req.body?.projectId == null ? null : Number(req.body.projectId),
      description: req.body?.description == null ? null : String(req.body.description),
      taskTypeCode: req.body?.taskTypeCode == null ? null : String(req.body.taskTypeCode),
      timeEntryId: req.body?.timeEntryId == null ? null : Number(req.body.timeEntryId),
    });
    sendSuccess(res, 201, activity);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const createEstimateRevisionController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const workActivityId = Number(req.params.id);
    if (!Number.isSafeInteger(workActivityId) || workActivityId <= 0) {
      throw new BadRequestError('Invalid id');
    }
    const origin = req.body?.origin as EstimateRevisionOrigin | undefined;
    const result = await createEstimateRevisionForActivity({
      actorUserId: req.user.userId,
      workActivityId,
      baseMinutes: req.body?.baseMinutes == null ? undefined : Number(req.body.baseMinutes),
      factor: req.body?.factor == null ? undefined : Number(req.body.factor),
      origin,
      reason: req.body?.reason == null ? null : String(req.body.reason).slice(0, 2000),
      parameterRevisionUuid:
        req.body?.parameterRevisionUuid == null
          ? null
          : String(req.body.parameterRevisionUuid),
      syncEstimatedOnLinkedEntries: req.body?.syncEstimatedOnLinkedEntries !== false,
    });
    sendSuccess(res, 201, result);
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const listDurationConfirmationsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestError('Invalid id');
    sendSuccess(
      res,
      200,
      await listTimeEntryDurationConfirmations({
        timeEntryId: id,
        actorUserId: req.user.userId,
        actorRoleId: req.user.roleId,
      })
    );
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const listEstimateRevisionsForEntryController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestError('Invalid id');
    sendSuccess(
      res,
      200,
      await listTimeEntryEstimateRevisions({
        timeEntryId: id,
        actorUserId: req.user.userId,
        actorRoleId: req.user.roleId,
      })
    );
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const getEstimateHistoryController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestError('Invalid id');
    sendSuccess(
      res,
      200,
      await getTimeEntryEstimateHistory({
        timeEntryId: id,
        actorUserId: req.user.userId,
        actorRoleId: req.user.roleId,
      })
    );
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const listEstimationReferencesForEntryController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestError('Invalid id');
    sendSuccess(
      res,
      200,
      await listTimeEntryEstimationReferences({
        timeEntryId: id,
        actorUserId: req.user.userId,
        actorRoleId: req.user.roleId,
      })
    );
  } catch (error) {
    sendError(res, toAppError(error));
  }
};
