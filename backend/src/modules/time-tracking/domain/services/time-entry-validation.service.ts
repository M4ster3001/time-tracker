import { BadRequestError } from '../../../../app/errors/app-error.js';
import { normalizeDateOnly } from '../../../../shared/domain/date.js';

export const MAX_SINGLE_ENTRY_MINUTES = 8 * 60;
export const MAX_DAILY_TOTAL_MINUTES = 12 * 60;

export const validateDurationMinutes = (durationMinutes: number): void => {
  if (!Number.isInteger(durationMinutes)) {
    throw new BadRequestError('Duration must be an integer number of minutes');
  }
  if (durationMinutes < 15) {
    throw new BadRequestError('Duration must be at least 15 minutes');
  }

  if (durationMinutes > MAX_SINGLE_ENTRY_MINUTES) {
    throw new BadRequestError('Duration cannot exceed 8 hours per entry');
  }
};

export const normalizeAndValidateEntryDate = (date: Date): Date => {
  if (!Number.isFinite(date.getTime())) throw new BadRequestError('Invalid entry date');
  const entryDate = normalizeDateOnly(date);
  const today = normalizeDateOnly(new Date());

  if (entryDate > today) {
    throw new BadRequestError('Cannot create time entry for future dates');
  }

  return entryDate;
};

export const assertDailyLimit = (usedMinutes: number, nextDurationMinutes: number): void => {
  if (usedMinutes + nextDurationMinutes > MAX_DAILY_TOTAL_MINUTES) {
    throw new BadRequestError('Daily total cannot exceed 12 hours');
  }
};
