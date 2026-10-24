/** Pure builders for client timesheet Excel rows (one workbook per client). */

export type TimesheetDetailSource = {
  date: Date;
  activityDescription: string;
  durationMinutes: number;
  /** Null/empty → shown as untitled project bucket. */
  projectName: string | null | undefined;
};

export type TimesheetDetailRow = {
  date: Date;
  /** UTC calendar day 1–31 */
  day: number;
  activity: string;
  projectName: string;
  durationMinutes: number;
};

export type TimesheetProjectTotal = {
  projectName: string;
  durationMinutes: number;
};

export const UNTITLED_PROJECT_LABEL = '(Sem projeto)';

const normalizeProjectName = (value: string | null | undefined): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNTITLED_PROJECT_LABEL;
};

const utcDayKey = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/**
 * Builds detail rows for a single-client timesheet.
 *
 * Same calendar day + **different** projects → separate rows (Excel AutoFilter on Projeto).
 * Same day + **same** project → one row (activities joined with " | ", minutes summed).
 */
export const buildTimesheetDetailRows = (
  entries: TimesheetDetailSource[],
  year: number,
  month: number
): TimesheetDetailRow[] => {
  type Acc = { date: Date; day: number; projectName: string; minutes: number; activities: string[] };
  const buckets = new Map<string, Acc>();

  for (const entry of entries) {
    if (entry.date.getUTCFullYear() !== year || entry.date.getUTCMonth() + 1 !== month) {
      continue;
    }
    if (!Number.isFinite(entry.durationMinutes) || entry.durationMinutes <= 0) {
      continue;
    }
    const projectName = normalizeProjectName(entry.projectName);
    const day = entry.date.getUTCDate();
    const key = `${utcDayKey(entry.date)}::${projectName}`;
    const existing = buckets.get(key);
    const activity = entry.activityDescription?.trim() ?? '';
    if (!existing) {
      buckets.set(key, {
        date: entry.date,
        day,
        projectName,
        minutes: entry.durationMinutes,
        activities: activity ? [activity] : [],
      });
      continue;
    }
    existing.minutes += entry.durationMinutes;
    if (activity && !existing.activities.some((a) => a.includes(activity) || activity.includes(a))) {
      existing.activities.push(activity);
    }
  }

  return [...buckets.values()]
    .sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.projectName.localeCompare(b.projectName, 'pt-BR');
    })
    .map((row) => ({
      date: row.date,
      day: row.day,
      activity: row.activities.join(' | '),
      projectName: row.projectName,
      durationMinutes: row.minutes,
    }));
};

export const summarizeTimesheetByProject = (
  rows: TimesheetDetailRow[]
): TimesheetProjectTotal[] => {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.projectName, (totals.get(row.projectName) ?? 0) + row.durationMinutes);
  }
  return [...totals.entries()]
    .map(([projectName, durationMinutes]) => ({ projectName, durationMinutes }))
    .sort((a, b) => b.durationMinutes - a.durationMinutes || a.projectName.localeCompare(b.projectName, 'pt-BR'));
};
