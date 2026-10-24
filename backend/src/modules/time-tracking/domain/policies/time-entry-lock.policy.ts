import {
  isEntryLocked,
  isMonthLocked,
  normalizeLockDay,
} from '../../../../shared/domain/policies/time-entry-lock.policy.js';
import { config } from '../../../../config.js';
import { ForbiddenError } from '../../../../app/errors/app-error.js';

export const resolveLockDay = (clientLockDay: number | null | undefined): number | null =>
  clientLockDay ?? config.timeEntryLockDay;

export const assertUnlockedOrTemporaryAllowed = async (params: {
  lockDay: number | null | undefined;
  entryDate: Date;
  bypassLock?: boolean;
  onLocked: () => Promise<boolean>;
}): Promise<number | null> => {
  const resolvedLockDay = resolveLockDay(params.lockDay);
  if (params.bypassLock || !isEntryLocked(params.entryDate, resolvedLockDay)) {
    return null;
  }

  const allowed = await params.onLocked();
  if (!allowed) {
    throw new ForbiddenError('Time entry month is locked');
  }

  return resolvedLockDay;
};

export { isEntryLocked, isMonthLocked, normalizeLockDay };
