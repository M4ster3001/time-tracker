/**
 * CAL-01 — aprovacao cria nova EstimationParameterRevision permanente (plano §4.3).
 * Nao reescreve revisoes passadas; apenas aponta previousRevisionId e encerra vigencia anterior.
 */

export type CalibrationDecision = 'APPROVE' | 'REJECT';

export type CurrentParameterRevision = {
  id: number;
  baseMinutes: number;
  factor: number;
  roundingMode: string;
};

export type CalibrationApprovalInput = {
  proposalState: 'DRAFT' | 'PROPOSED' | 'APPROVED' | 'REJECTED';
  proposedBaseMinutes: number | null;
  proposedFactor: number | null;
  currentRevision: CurrentParameterRevision | null;
  effectiveFrom: Date;
  decision: CalibrationDecision;
  actorUserId: number;
  justification?: string | null;
};

export type ParameterRevisionPayload = {
  baseMinutes: number;
  factor: number;
  roundingMode: string;
  effectiveFrom: Date;
  authorUserId: number;
  reason: string | null;
  previousRevisionId: number | null;
};

export type CalibrationApprovalResult = {
  nextState: 'APPROVED' | 'REJECTED';
  parameterRevision: ParameterRevisionPayload | null;
  closesPreviousRevision: boolean;
};

export const decideCalibrationProposal = (
  input: CalibrationApprovalInput
): CalibrationApprovalResult => {
  if (input.proposalState === 'APPROVED' || input.proposalState === 'REJECTED') {
    throw new Error('CALIBRATION_ALREADY_DECIDED');
  }

  if (input.decision === 'REJECT') {
    return {
      nextState: 'REJECTED',
      parameterRevision: null,
      closesPreviousRevision: false,
    };
  }

  if (
    input.proposedBaseMinutes == null ||
    !Number.isFinite(input.proposedBaseMinutes) ||
    input.proposedBaseMinutes <= 0 ||
    input.proposedFactor == null ||
    !Number.isFinite(input.proposedFactor) ||
    input.proposedFactor <= 0
  ) {
    throw new Error('CALIBRATION_PROPOSAL_INCOMPLETE');
  }

  return {
    nextState: 'APPROVED',
    parameterRevision: {
      baseMinutes: Math.round(input.proposedBaseMinutes),
      factor: input.proposedFactor,
      roundingMode: input.currentRevision?.roundingMode ?? 'NEAREST_MINUTE',
      effectiveFrom: input.effectiveFrom,
      authorUserId: input.actorUserId,
      reason: input.justification?.trim() || null,
      previousRevisionId: input.currentRevision?.id ?? null,
    },
    closesPreviousRevision: input.currentRevision != null,
  };
};
