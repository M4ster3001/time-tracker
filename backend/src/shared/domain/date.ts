export const normalizeDateOnly = (value: Date): Date => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

export const parseDateOnly = (value: string | Date): Date | null => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return normalizeDateOnly(value);
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ? null : date;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return normalizeDateOnly(parsed);
};

export const getMonthRangeUTC = (year: number, month: number): { start: Date; end: Date } => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
};

const getDaysInMonthUTC = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * Periodo de fechamento:
 * - Fim: dia de fechamento do mes/ano alvo (ajustado para o ultimo dia existente no mes)
 * - Inicio: dia seguinte ao fechamento do mes anterior (tambem ajustado para o ultimo dia existente)
 */
export const getClosingPeriodRangeUTC = (
  year: number,
  month: number,
  lockDay: number
): { start: Date; end: Date } => {
  const normalizedLockDay = Math.max(1, Math.min(31, Math.round(lockDay)));
  const currentMonthDays = getDaysInMonthUTC(year, month);
  const effectiveCurrentCloseDay = Math.min(normalizedLockDay, currentMonthDays);

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonthDays = getDaysInMonthUTC(previousYear, previousMonth);
  const effectivePreviousCloseDay = Math.min(normalizedLockDay, previousMonthDays);

  const startDay = effectivePreviousCloseDay + 1;
  const start =
    startDay <= previousMonthDays
      ? new Date(Date.UTC(previousYear, previousMonth - 1, startDay))
      : new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month - 1, effectiveCurrentCloseDay));

  return { start, end };
};

export const getWorkingDaysInMonth = (year: number, month: number): number => {
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= totalDays; day += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday >= 1 && weekday <= 5) count += 1;
  }
  return count;
};

export const getWorkingDaysInRange = (start: Date, end: Date): number => {
  const cursor = normalizeDateOnly(start);
  const last = normalizeDateOnly(end);
  let count = 0;
  while (cursor.getTime() <= last.getTime()) {
    const weekday = cursor.getUTCDay();
    if (weekday >= 1 && weekday <= 5) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
};
