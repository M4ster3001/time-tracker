import { BadRequestError, ForbiddenError } from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import {
  compareCalibrationSample,
  type CalibrationSampleRow,
} from '../domain/calibration-compare.js';
import {
  filterCalibrationSampleRows,
  type CalibrationExclusionReason,
  type CalibrationSampleRowWithExclusion,
} from '../domain/calibration-exclusions.js';

export const previewCalibrationComparison = async (input: {
  actorUserId: number;
  rows?: CalibrationSampleRowWithExclusion[];
  keepExclusionReasons?: readonly CalibrationExclusionReason[];
  taskTypeCode?: string | null;
  parameterSetId?: number | null;
  /** Contexto de precedência quando parameterSetId não é informado. */
  targetClientId?: number | null;
  targetProjectId?: number | null;
  proposedBaseMinutes?: number | null;
  proposedFactor?: number | null;
  justification?: string | null;
  persistDraft?: boolean;
  markProposed?: boolean;
}) => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  let rows: CalibrationSampleRowWithExclusion[] = input.rows ?? [];
  if (rows.length === 0) {
    const entries = await prisma.timeEntry.findMany({
      where: {
        deletedAt: null,
        estimatedDurationMinutes: { not: null },
        confirmedDurationMinutes: { not: null },
      },
      select: {
        estimatedDurationMinutes: true,
        confirmedDurationMinutes: true,
        actualTrackedDurationMinutes: true,
      },
      take: 500,
    });
    rows = entries.map((e) => ({
      estimatedMinutes: e.estimatedDurationMinutes!,
      confirmedMinutes: e.confirmedDurationMinutes!,
      actualTrackedMinutes: e.actualTrackedDurationMinutes,
      exclusionReason: null,
    }));
  }

  const filtered = filterCalibrationSampleRows(rows, {
    keepReasons: input.keepExclusionReasons,
  });
  const eligibleRows: CalibrationSampleRow[] = filtered.included;

  let comparison;
  try {
    comparison = compareCalibrationSample(eligibleRows);
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  let proposalUuid: string | null = null;
  let proposalId: number | null = null;
  if (input.persistDraft) {
    const draft = await prisma.calibrationProposal.create({
      data: {
        taskTypeCode: input.taskTypeCode ?? null,
        parameterSetId: input.parameterSetId ?? null,
        targetClientId: input.targetClientId ?? null,
        targetProjectId: input.targetProjectId ?? null,
        sampleSize: comparison.sampleSize,
        medianAbsErrorMinutes:
          comparison.estimatedVsConfirmed.medianAbsoluteErrorMinutes ?? undefined,
        biasMinutes: comparison.estimatedVsConfirmed.biasMinutes ?? undefined,
        measuredSampleSize: comparison.estimatedVsMeasured.sampleSize,
        proposedBaseMinutes: input.proposedBaseMinutes ?? null,
        proposedFactor: input.proposedFactor ?? null,
        state: input.markProposed ? 'PROPOSED' : 'DRAFT',
        authorUserId: input.actorUserId,
        justification: input.justification ?? 'CAL-01 draft from comparison preview',
      },
    });
    proposalUuid = draft.uuid;
    proposalId = draft.id;
  }

  return {
    comparison,
    proposalUuid,
    proposalId,
    exclusions: {
      excludedCount: filtered.excludedCount,
      excludedByReason: filtered.excludedByReason,
    },
  };
};
