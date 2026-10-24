import { normalizeDateOnly } from '../date.js';

export const normalizeLockDay = (lockDay: number | null): number | null => {
  if (lockDay === null) return null;
  if (!Number.isFinite(lockDay)) return null;
  return Math.min(31, Math.max(1, Math.round(lockDay)));
};

export const isEntryLocked = (
  entryDate: Date,
  lockDay: number | null,
  now = new Date()
): boolean => {
  const normalizedLockDay = normalizeLockDay(lockDay);
  if (normalizedLockDay === null) return false;

  const entry = normalizeDateOnly(entryDate);
  const today = normalizeDateOnly(now);

  const entryMonthStart = new Date(Date.UTC(entry.getUTCFullYear(), entry.getUTCMonth(), 1));
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const todayDay = today.getUTCDate();

  if (entryMonthStart.getTime() < currentMonthStart.getTime()) {
    return true;
  }

  if (entryMonthStart.getTime() === currentMonthStart.getTime()) {
    return todayDay > normalizedLockDay && entry.getUTCDate() <= normalizedLockDay;
  }
  return false;
};

export const isMonthLocked = (
  year: number,
  month: number,
  lockDay: number | null,
  now = new Date()
): boolean => {
  const normalizedLockDay = normalizeLockDay(lockDay);
  if (normalizedLockDay === null) return false;
  const today = normalizeDateOnly(now);
  const targetMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  if (targetMonthStart.getTime() === currentMonthStart.getTime()) {
    return false;
  }

  return targetMonthStart.getTime() < currentMonthStart.getTime();
};
