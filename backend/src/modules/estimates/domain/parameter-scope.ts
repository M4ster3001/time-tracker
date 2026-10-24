/**
 * EST-01 — escopos de EstimationParameterSet e precedência (plano §4.2).
 * precedência = projeto > cliente > global; não combinar fatores entre níveis.
 */

export type EstimationScopeKind = 'GLOBAL' | 'CLIENT' | 'PROJECT';

export type ParameterSetCandidate = {
  id: number;
  scope: EstimationScopeKind;
  clientId: number | null;
  projectId: number | null;
  isActive: boolean;
  revisionUuid: string | null;
  baseMinutes: number;
  factor: number;
};

export type ParameterScopeContext = {
  clientId?: number | null;
  projectId?: number | null;
};

const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export const normalizeEstimationScope = (raw: unknown): EstimationScopeKind => {
  const value = String(raw ?? 'GLOBAL')
    .trim()
    .toUpperCase();
  if (value === 'CLIENT' || value === 'PROJECT' || value === 'GLOBAL') return value;
  throw new Error('PARAMETER_SCOPE_INVALID');
};

export const assertParameterScopeTargets = (input: {
  scope: EstimationScopeKind;
  clientId?: number | null;
  projectId?: number | null;
}): { scope: EstimationScopeKind; clientId: number | null; projectId: number | null } => {
  const clientId = input.clientId == null ? null : Number(input.clientId);
  const projectId = input.projectId == null ? null : Number(input.projectId);

  if (input.scope === 'GLOBAL') {
    if (clientId != null || projectId != null) {
      throw new Error('PARAMETER_SCOPE_GLOBAL_NO_TARGET');
    }
    return { scope: 'GLOBAL', clientId: null, projectId: null };
  }

  if (input.scope === 'CLIENT') {
    if (!isPositiveInt(clientId)) throw new Error('PARAMETER_SCOPE_CLIENT_REQUIRED');
    if (projectId != null) throw new Error('PARAMETER_SCOPE_CLIENT_NO_PROJECT');
    return { scope: 'CLIENT', clientId, projectId: null };
  }

  if (!isPositiveInt(clientId)) throw new Error('PARAMETER_SCOPE_CLIENT_REQUIRED');
  if (!isPositiveInt(projectId)) throw new Error('PARAMETER_SCOPE_PROJECT_REQUIRED');
  return { scope: 'PROJECT', clientId, projectId };
};

/** Seleciona uma revisão completa: projeto > cliente > global. */
export const selectParameterSetByPrecedence = (
  candidates: ParameterSetCandidate[],
  context: ParameterScopeContext
): ParameterSetCandidate | null => {
  const active = candidates.filter((row) => row.isActive);
  const projectId = context.projectId ?? null;
  const clientId = context.clientId ?? null;

  if (isPositiveInt(projectId)) {
    const projectMatch = active.find(
      (row) =>
        row.scope === 'PROJECT' &&
        row.projectId === projectId &&
        (row.clientId == null || row.clientId === clientId || !isPositiveInt(clientId))
    );
    if (projectMatch) return projectMatch;
  }

  if (isPositiveInt(clientId)) {
    const clientMatch = active.find(
      (row) => row.scope === 'CLIENT' && row.clientId === clientId && row.projectId == null
    );
    if (clientMatch) return clientMatch;
  }

  return active.find((row) => row.scope === 'GLOBAL' && row.clientId == null && row.projectId == null) ?? null;
};
