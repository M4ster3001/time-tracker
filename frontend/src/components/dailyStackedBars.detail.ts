export type DailyBarFocusKey = string;

export const dailyBarFocusKey = (date: string, clientId: number): DailyBarFocusKey =>
  `${date}:${clientId}`;

export const parseDailyBarFocusKey = (
  key: DailyBarFocusKey | null
): { date: string; clientId: number } | null => {
  if (!key) return null;
  const sep = key.lastIndexOf(':');
  if (sep <= 0) return null;
  const date = key.slice(0, sep);
  const clientId = Number(key.slice(sep + 1));
  if (!date || !Number.isSafeInteger(clientId)) return null;
  return { date, clientId };
};
