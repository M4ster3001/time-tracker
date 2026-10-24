/**
 * CAL-01 / EST-01 — alvo do set ao aprovar calibração.
 * Precedência projeto > cliente > global (sem fallback GLOBAL cego quando há contexto).
 */

import {
  selectParameterSetByPrecedence,
  type EstimationScopeKind,
  type ParameterScopeContext,
  type ParameterSetCandidate,
} from './parameter-scope.js';

export type CalibrationParameterSetRow = {
  id: number;
  scope: EstimationScopeKind;
  clientId: number | null;
  projectId: number | null;
  isActive: boolean;
};

const toCandidate = (row: CalibrationParameterSetRow): ParameterSetCandidate => ({
  id: row.id,
  scope: row.scope,
  clientId: row.clientId,
  projectId: row.projectId,
  isActive: row.isActive,
  revisionUuid: `cal-target-${row.id}`,
  baseMinutes: 0,
  factor: 1,
});

/**
 * Resolve o EstimationParameterSet alvo da aprovação.
 * - `explicitParameterSetId` presente: usa esse id se estiver ativo na lista; senão null.
 * - Caso contrário: precedência com `context` (vazio ⇒ só GLOBAL elegível).
 */
export const resolveCalibrationTargetParameterSet = (input: {
  explicitParameterSetId?: number | null;
  candidates: readonly CalibrationParameterSetRow[];
  context?: ParameterScopeContext | null;
}): CalibrationParameterSetRow | null => {
  const active = input.candidates.filter((row) => row.isActive);
  const explicit = input.explicitParameterSetId;
  if (explicit != null) {
    if (!Number.isSafeInteger(explicit) || explicit <= 0) return null;
    return active.find((row) => row.id === explicit) ?? null;
  }

  const picked = selectParameterSetByPrecedence(
    active.map(toCandidate),
    input.context ?? {}
  );
  if (!picked) return null;
  return active.find((row) => row.id === picked.id) ?? null;
};
