export const getUtcToday = (reference = new Date()): Date =>
  new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));

export const normalizeDateOnlyUTC = (value?: Date | null): Date => {
  if (!value || Number.isNaN(value.getTime())) return getUtcToday();
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

export const addDaysUTC = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const formatDateKeyUTC = (value: Date): string =>
  `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(
    value.getUTCDate()
  ).padStart(2, '0')}`;

export const getStartOfNextMonthUTC = (reference = new Date()): Date =>
  new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
