import { ForbiddenError, NotFoundError } from '../../../../app/errors/app-error.js';
import type { ITimeEntry } from '../time-entry.types.js';
import type { TimeEntryRepository } from '../repositories/time-entry.repository.js';

export const canBypassLockForCorrection = (
  entryOwnerId: number,
  callerId: number,
  callerRoleId?: number
): boolean => {
  if (entryOwnerId === callerId) return false;
  return callerRoleId === 1 || callerRoleId === 2;
};

export const assertTimeEntryAccess = async (
  repository: TimeEntryRepository,
  timeEntry: ITimeEntry | null,
  callerId: number,
  callerRoleId?: number
): Promise<void> => {
  if (!timeEntry) {
    throw new NotFoundError('Time entry not found or unauthorized');
  }

  if (timeEntry.userId === callerId) return;
  if (callerRoleId === 1) return;

  if (callerRoleId === 2) {
    const managed = await repository.findManagedEntryAccess(timeEntry.userId, callerId);
    if (managed) return;
  }

  throw new ForbiddenError('Time entry not found or unauthorized');
};
