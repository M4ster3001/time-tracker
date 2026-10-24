export type ParameterSetDeactivateInput = {
  id: number;
  isActive: boolean;
  scope: string;
};

export type ParameterSetDeactivateDraft = {
  id: number;
  isActive: false;
};

/** Soft-deactivate keeps revisions/history; only flips isActive. */
export const buildParameterSetDeactivateDraft = (
  set: ParameterSetDeactivateInput
): ParameterSetDeactivateDraft => {
  if (!set.isActive) {
    throw new Error('PARAMETER_SET_ALREADY_INACTIVE');
  }
  return { id: set.id, isActive: false };
};
