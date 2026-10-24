/**
 * WorkActivity + EstimateRevision (plano §4.1) — persistencia minima.
 * Ajuste ONE_OFF nao muta o catalogo; CATALOG apenas registra snapshot da revisao usada.
 */

export type WorkActivityState = 'OPEN' | 'DONE' | 'CANCELLED';

export type WorkActivityDraft = {
  clientId: number;
  projectId: number | null;
  title: string;
  description: string | null;
  taskTypeCode: string | null;
  ownerUserId: number | null;
  state: WorkActivityState;
  version: number;
};

export type EstimateRevisionOrigin = 'CATALOG' | 'ONE_OFF' | 'MCP' | 'AI';

export type EstimateRevisionDraft = {
  workActivityId: number;
  version: number;
  baseMinutes: number;
  factor: number;
  rawMinutes: number;
  suggestedMinutes: number;
  roundingMode: string;
  parameterRevisionUuid: string | null;
  origin: EstimateRevisionOrigin;
  algorithmVersion: string;
  authorUserId: number | null;
  reason: string | null;
  previousRevisionId: number | null;
  mutatesCatalog: boolean;
};

export const createWorkActivityDraft = (input: {
  clientId: number;
  title: string;
  ownerUserId?: number | null;
  projectId?: number | null;
  description?: string | null;
  taskTypeCode?: string | null;
}): WorkActivityDraft => {
  const title = input.title.trim();
  if (!title) throw new Error('WORK_ACTIVITY_TITLE_REQUIRED');
  if (!Number.isSafeInteger(input.clientId) || input.clientId <= 0) {
    throw new Error('WORK_ACTIVITY_CLIENT_REQUIRED');
  }
  return {
    clientId: input.clientId,
    projectId: input.projectId ?? null,
    title,
    description: input.description?.trim() || null,
    taskTypeCode: input.taskTypeCode?.trim().toUpperCase() || null,
    ownerUserId: input.ownerUserId ?? null,
    state: 'OPEN',
    version: 1,
  };
};

export const nextEstimateRevisionVersion = (
  previousVersion: number | null | undefined
): number => {
  if (previousVersion == null || !Number.isFinite(previousVersion) || previousVersion < 1) {
    return 1;
  }
  return Math.floor(previousVersion) + 1;
};

export const applyEstimateRevision = (input: {
  workActivityId: number;
  previousVersion?: number | null;
  previousRevisionId?: number | null;
  baseMinutes: number;
  factor: number;
  rawMinutes: number;
  suggestedMinutes: number;
  roundingMode?: string;
  parameterRevisionUuid?: string | null;
  origin: EstimateRevisionOrigin;
  authorUserId?: number | null;
  reason?: string | null;
  algorithmVersion?: string;
}): EstimateRevisionDraft => {
  if (!Number.isFinite(input.baseMinutes) || input.baseMinutes <= 0) {
    throw new Error('ESTIMATE_REVISION_BASE_INVALID');
  }
  if (!Number.isFinite(input.factor) || input.factor <= 0) {
    throw new Error('ESTIMATE_REVISION_FACTOR_INVALID');
  }
  return {
    workActivityId: input.workActivityId,
    version: nextEstimateRevisionVersion(input.previousVersion),
    baseMinutes: Math.round(input.baseMinutes),
    factor: input.factor,
    rawMinutes: input.rawMinutes,
    suggestedMinutes: Math.round(input.suggestedMinutes),
    roundingMode: input.roundingMode ?? 'NEAREST_MINUTE',
    parameterRevisionUuid: input.parameterRevisionUuid ?? null,
    origin: input.origin,
    algorithmVersion: input.algorithmVersion ?? 'EST-01',
    authorUserId: input.authorUserId ?? null,
    reason: input.reason?.trim() || null,
    previousRevisionId: input.previousRevisionId ?? null,
    mutatesCatalog: false,
  };
};
