import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import { decideCalibrationProposal } from '../domain/calibration-approval.js';
import { resolveCalibrationTargetParameterSet } from '../domain/calibration-target-set.js';
import { evaluateCalibrationThresholds } from '../domain/calibration-thresholds.js';
import type { EstimationScopeKind } from '../domain/parameter-scope.js';
import { getCalibrationThresholdConfig } from './calibration-policy.service.js';

const asScope = (raw: string): EstimationScopeKind | null => {
  if (raw === 'GLOBAL' || raw === 'CLIENT' || raw === 'PROJECT') return raw;
  return null;
};

export const approveOrRejectCalibrationProposal = async (input: {
  proposalId: number;
  actorUserId: number;
  decision: 'APPROVE' | 'REJECT';
  justification?: string | null;
  effectiveFrom?: Date;
  /** Override opcional do contexto de precedência persistido na proposta. */
  targetClientId?: number | null;
  targetProjectId?: number | null;
}) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  const proposal = await prisma.calibrationProposal.findUnique({
    where: { id: input.proposalId },
  });
  if (!proposal) throw new NotFoundError('Calibration proposal not found');

  if (input.decision === 'APPROVE') {
    const thresholds = await getCalibrationThresholdConfig();
    const evaluation = evaluateCalibrationThresholds(
      {
        sampleSize: proposal.sampleSize,
        estimatedVsConfirmed: {
          sampleSize: proposal.sampleSize,
          medianAbsoluteErrorMinutes: proposal.medianAbsErrorMinutes,
          biasMinutes: proposal.biasMinutes,
        },
        estimatedVsMeasured: {
          sampleSize: proposal.measuredSampleSize,
          medianAbsoluteErrorMinutes: null,
          biasMinutes: null,
        },
        rowsExcludedForMissingMeasured: 0,
      },
      thresholds
    );
    if (!evaluation.passed) {
      throw new BadRequestError(
        `CALIBRATION_THRESHOLDS_NOT_MET:${evaluation.failures.join(',')}`
      );
    }
  }

  const targetClientId =
    input.targetClientId !== undefined ? input.targetClientId : proposal.targetClientId;
  const targetProjectId =
    input.targetProjectId !== undefined ? input.targetProjectId : proposal.targetProjectId;

  let parameterSetId = proposal.parameterSetId;
  if (parameterSetId == null && proposal.taskTypeCode) {
    const taskType = await prisma.taskType.findUnique({
      where: { code: proposal.taskTypeCode.toUpperCase() },
    });
    if (taskType) {
      const sets = await prisma.estimationParameterSet.findMany({
        where: { taskTypeId: taskType.id, isActive: true },
        select: {
          id: true,
          scope: true,
          clientId: true,
          projectId: true,
          isActive: true,
        },
      });
      const candidates = sets
        .map((set) => {
          const scope = asScope(set.scope);
          if (!scope) return null;
          return {
            id: set.id,
            scope,
            clientId: set.clientId,
            projectId: set.projectId,
            isActive: set.isActive,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);

      const picked = resolveCalibrationTargetParameterSet({
        explicitParameterSetId: null,
        candidates,
        context: { clientId: targetClientId, projectId: targetProjectId },
      });
      parameterSetId = picked?.id ?? null;
    }
  }

  const currentRevision =
    parameterSetId == null
      ? null
      : await prisma.estimationParameterRevision.findFirst({
          where: { parameterSetId },
          orderBy: { effectiveFrom: 'desc' },
        });

  let decision;
  try {
    decision = decideCalibrationProposal({
      proposalState: proposal.state,
      proposedBaseMinutes: proposal.proposedBaseMinutes,
      proposedFactor: proposal.proposedFactor == null ? null : Number(proposal.proposedFactor),
      currentRevision: currentRevision
        ? {
            id: currentRevision.id,
            baseMinutes: currentRevision.baseMinutes,
            factor: Number(currentRevision.factor),
            roundingMode: currentRevision.roundingMode,
          }
        : null,
      effectiveFrom: input.effectiveFrom ?? new Date(),
      decision: input.decision,
      actorUserId: input.actorUserId,
      justification: input.justification ?? proposal.justification,
    });
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  if (input.decision === 'APPROVE' && parameterSetId == null) {
    throw new BadRequestError('CALIBRATION_PARAMETER_SET_REQUIRED');
  }

  return prisma.$transaction(async (tx) => {
    let resultingRevisionId: number | null = null;

    if (decision.parameterRevision && parameterSetId != null) {
      if (decision.closesPreviousRevision && currentRevision) {
        await tx.estimationParameterRevision.update({
          where: { id: currentRevision.id },
          data: {
            effectiveTo: decision.parameterRevision.effectiveFrom,
          },
        });
      }

      const created = await tx.estimationParameterRevision.create({
        data: {
          parameterSetId,
          baseMinutes: decision.parameterRevision.baseMinutes,
          factor: decision.parameterRevision.factor,
          roundingMode: decision.parameterRevision.roundingMode,
          effectiveFrom: decision.parameterRevision.effectiveFrom,
          authorUserId: decision.parameterRevision.authorUserId,
          reason: decision.parameterRevision.reason,
          previousRevisionId: decision.parameterRevision.previousRevisionId,
        },
      });
      resultingRevisionId = created.id;
    }

    const updated = await tx.calibrationProposal.update({
      where: { id: proposal.id },
      data: {
        state: decision.nextState,
        decidedByUserId: input.actorUserId,
        decidedAt: new Date(),
        justification: input.justification ?? proposal.justification,
        parameterSetId: parameterSetId ?? proposal.parameterSetId,
        resultingRevisionId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        endpoint: `/api/estimates/calibration/${proposal.id}/decide`,
        action: `CALIBRATION_${input.decision}`,
        status: 'success',
        details: JSON.stringify({
          proposalId: proposal.id,
          decision: input.decision,
          nextState: decision.nextState,
          resultingRevisionId,
          previousRevisionId: currentRevision?.id ?? null,
        }).slice(0, 4000),
      },
    });

    return { proposal: updated, resultingRevisionId };
  });
};
