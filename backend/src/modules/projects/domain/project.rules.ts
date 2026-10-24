/**
 * PRJ-01 — regras de projeto (plano §5).
 * Projeto e opcional; codigo unico por cliente; sem acesso implicito a outros clientes.
 */

export type ProjectState = 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export const PROJECT_STATES: ProjectState[] = [
  'PLANNED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
];

export const normalizeProjectCode = (raw: string): string => raw.trim().toUpperCase();

export const assertProjectCode = (raw: string): string => {
  const code = normalizeProjectCode(raw);
  if (!code) throw new Error('PROJECT_CODE_REQUIRED');
  if (code.length > 64) throw new Error('PROJECT_CODE_TOO_LONG');
  return code;
};

export const assertProjectBelongsToClient = (input: {
  projectClientId: number;
  requestedClientId: number;
}): void => {
  if (input.projectClientId !== input.requestedClientId) {
    throw new Error('PROJECT_CLIENT_MISMATCH');
  }
};

export type ProjectCapability = 'canCreateTimeEntry';

export const assertProjectTransition = (
  state: ProjectState,
  capability: ProjectCapability
): boolean => {
  if (capability === 'canCreateTimeEntry') {
    return state === 'PLANNED' || state === 'ACTIVE';
  }
  return false;
};
