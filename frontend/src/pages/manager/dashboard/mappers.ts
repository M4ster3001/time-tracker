import { formatMinutes } from '../../../utils/formatters';
import type { DailyBucket } from '../../../components/DailyStackedBars';
import type { TimelinePoint } from '../../../components/DashboardPanels';

export const buildWeekTimeline = (daily: DailyBucket[], weeksBack = 0): TimelinePoint[] => {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const endIndex = Math.max(0, sorted.length - weeksBack * 7);
  return sorted.slice(Math.max(0, endIndex - 7), endIndex).map((day) => ({
    label: day.date.slice(8),
    value: day.totalMinutes,
    caption: formatMinutes(day.totalMinutes),
  }));
};

export const sumTimelinePoints = (points: TimelinePoint[]) =>
  points.reduce((acc, point) => acc + point.value, 0);

export const getDaysUntilClosing = (lockDay: number, baseDate: Date) => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const current = new Date(year, month, Math.min(lockDay, new Date(year, month + 1, 0).getDate()));
  const next =
    current >= baseDate
      ? current
      : new Date(year, month + 1, Math.min(lockDay, new Date(year, month + 2, 0).getDate()));
  return Math.ceil((next.getTime() - baseDate.getTime()) / 86400000);
};
