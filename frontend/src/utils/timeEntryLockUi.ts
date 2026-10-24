interface AuthUserLike {
  id: number;
  roleId: number;
}

interface LockStatusLike {
  locked: boolean;
  lockDay: number;
  temporaryUnlock?: boolean;
}

export const canPrivilegedCorrectLockedEntry = (
  isEditing: boolean,
  user: AuthUserLike | null | undefined,
  entryOwnerId: number | null
): boolean => {
  if (!isEditing || !user || entryOwnerId === null) return false;
  const isPrivileged = user.roleId === 1 || user.roleId === 2;
  return isPrivileged && entryOwnerId !== user.id;
};

export const isLockBlockingEdit = (
  lockStatus: LockStatusLike | null,
  privilegedCorrection: boolean
): boolean => {
  const locked = (lockStatus?.locked ?? false) && !lockStatus?.temporaryUnlock;
  return locked && !privilegedCorrection;
};
