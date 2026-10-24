/**
 * EST-01 — catálogo de tipos de tarefa (rascunhos puros).
 * Código estável; nomes PT/EN; arquivamento via isActive (sem exclusão física).
 */

export type RoundingMode = 'NEAREST_MINUTE' | 'CEIL_MINUTE' | 'FLOOR_MINUTE';

export type TaskTypeInitialParameters = {
  baseMinutes: number;
  factor: number;
  roundingMode: RoundingMode;
};

export type TaskTypeCreateDraft = {
  code: string;
  namePt: string;
  nameEn: string;
  description: string | null;
  isActive: boolean;
  initialParameters: TaskTypeInitialParameters | null;
};

export type TaskTypeUpdateDraft = {
  namePt?: string;
  nameEn?: string;
  description?: string | null;
  isActive?: boolean;
};

const CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;

export const normalizeTaskTypeCode = (raw: string): string => raw.trim().toUpperCase();

const requireName = (raw: string | undefined, errorCode: string): string => {
  const value = (raw ?? '').trim();
  if (!value) throw new Error(errorCode);
  return value.slice(0, 120);
};

export const buildTaskTypeParameterDraft = (input: {
  baseMinutes: number;
  factor: number;
  roundingMode?: string | null;
}): TaskTypeInitialParameters => {
  const baseMinutes = Number(input.baseMinutes);
  const factor = Number(input.factor);
  if (!Number.isFinite(baseMinutes) || baseMinutes <= 0) {
    throw new Error('ESTIMATE_BASE_INVALID');
  }
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error('ESTIMATE_FACTOR_INVALID');
  }
  const mode = (input.roundingMode ?? 'NEAREST_MINUTE').trim().toUpperCase();
  const roundingMode: RoundingMode =
    mode === 'CEIL_MINUTE' || mode === 'FLOOR_MINUTE' ? mode : 'NEAREST_MINUTE';
  return { baseMinutes, factor, roundingMode };
};

const parseOptionalParameters = (input: {
  baseMinutes?: number | null;
  factor?: number | null;
  roundingMode?: string | null;
}): TaskTypeInitialParameters | null => {
  const hasBase = input.baseMinutes != null && input.baseMinutes !== undefined;
  const hasFactor = input.factor != null && input.factor !== undefined;
  if (!hasBase && !hasFactor) return null;
  if (!hasBase || !hasFactor) {
    throw new Error('TASK_TYPE_PARAMETERS_INCOMPLETE');
  }
  return buildTaskTypeParameterDraft({
    baseMinutes: Number(input.baseMinutes),
    factor: Number(input.factor),
    roundingMode: input.roundingMode,
  });
};

export const buildTaskTypeCreateDraft = (input: {
  code: string;
  namePt: string;
  nameEn: string;
  description?: string | null;
  baseMinutes?: number | null;
  factor?: number | null;
  roundingMode?: string | null;
}): TaskTypeCreateDraft => {
  const code = normalizeTaskTypeCode(input.code);
  if (!CODE_RE.test(code)) throw new Error('TASK_TYPE_CODE_INVALID');
  return {
    code,
    namePt: requireName(input.namePt, 'TASK_TYPE_NAME_PT_REQUIRED'),
    nameEn: requireName(input.nameEn, 'TASK_TYPE_NAME_EN_REQUIRED'),
    description: input.description?.trim() ? input.description.trim().slice(0, 4000) : null,
    isActive: true,
    initialParameters: parseOptionalParameters(input),
  };
};

export const buildTaskTypeUpdateDraft = (input: {
  namePt?: string | null;
  nameEn?: string | null;
  description?: string | null;
  isActive?: boolean | null;
}): TaskTypeUpdateDraft => {
  const draft: TaskTypeUpdateDraft = {};
  if (input.namePt !== undefined && input.namePt !== null) {
    draft.namePt = requireName(input.namePt, 'TASK_TYPE_NAME_PT_REQUIRED');
  }
  if (input.nameEn !== undefined && input.nameEn !== null) {
    draft.nameEn = requireName(input.nameEn, 'TASK_TYPE_NAME_EN_REQUIRED');
  }
  if (input.description !== undefined) {
    const trimmed = input.description?.trim() ?? '';
    draft.description = trimmed ? trimmed.slice(0, 4000) : null;
  }
  if (input.isActive !== undefined && input.isActive !== null) {
    draft.isActive = Boolean(input.isActive);
  }
  return draft;
};
