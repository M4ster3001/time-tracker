const HOUR_PATTERN = /([0-9]+(?:\.[0-9]+)?)\s*(h|hr|hour|hours)(?=\d|\s|$)/gi;
const MIN_PATTERN = /([0-9]+)\s*(m|min|mins|minute|minutes)(?=\d|\s|$)/gi;

export const parseDurationMinutes = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  if (typeof value !== 'string') return null;

  const input = value.trim().toLowerCase();
  if (!input) return null;

  if (/^[0-9]+$/.test(input)) {
    return Number(input);
  }

  let hours = 0;
  let minutes = 0;

  let match: RegExpExecArray | null;
  while ((match = HOUR_PATTERN.exec(input)) !== null) {
    hours += Number(match[1]);
  }
  while ((match = MIN_PATTERN.exec(input)) !== null) {
    minutes += Number(match[1]);
  }

  if (hours === 0 && minutes === 0) return null;

  const totalMinutes = Math.round(hours * 60 + minutes);
  return Number.isFinite(totalMinutes) ? totalMinutes : null;
};
