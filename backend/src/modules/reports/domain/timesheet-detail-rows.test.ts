import { describe, expect, it } from 'vitest';
import {
  UNTITLED_PROJECT_LABEL,
  buildTimesheetDetailRows,
  summarizeTimesheetByProject,
} from './timesheet-detail-rows.js';

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

describe('buildTimesheetDetailRows', () => {
  it('keeps two rows when the same day has two projects on the same client', () => {
    const rows = buildTimesheetDetailRows(
      [
        {
          date: d(2026, 9, 2),
          activityDescription: 'Deploy HML',
          durationMinutes: 210,
          projectName: 'Fluxo de Caixa',
        },
        {
          date: d(2026, 9, 2),
          activityDescription: 'Fullscreen tabela',
          durationMinutes: 90,
          projectName: 'Sentinel',
        },
      ],
      2026,
      9
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.projectName)).toEqual(['Fluxo de Caixa', 'Sentinel']);
    expect(rows.every((r) => r.day === 2)).toBe(true);
    expect(rows[0]?.durationMinutes).toBe(210);
    expect(rows[1]?.durationMinutes).toBe(90);
  });

  it('merges activities on the same day and project', () => {
    const rows = buildTimesheetDetailRows(
      [
        {
          date: d(2026, 9, 3),
          activityDescription: 'ACL Postgres',
          durationMinutes: 120,
          projectName: 'Fluxo de Caixa',
        },
        {
          date: d(2026, 9, 3),
          activityDescription: 'Hub por área',
          durationMinutes: 60,
          projectName: 'Fluxo de Caixa',
        },
      ],
      2026,
      9
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.durationMinutes).toBe(180);
    expect(rows[0]?.activity).toContain('ACL Postgres');
    expect(rows[0]?.activity).toContain('Hub por área');
  });

  it('buckets missing project name and ignores other months', () => {
    const rows = buildTimesheetDetailRows(
      [
        {
          date: d(2026, 9, 10),
          activityDescription: 'Sem projeto',
          durationMinutes: 30,
          projectName: null,
        },
        {
          date: d(2026, 8, 10),
          activityDescription: 'Outro mês',
          durationMinutes: 99,
          projectName: 'Sentinel',
        },
      ],
      2026,
      9
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.projectName).toBe(UNTITLED_PROJECT_LABEL);
    expect(rows[0]?.durationMinutes).toBe(30);
  });
});

describe('summarizeTimesheetByProject', () => {
  it('sums minutes per project across days', () => {
    const rows = buildTimesheetDetailRows(
      [
        {
          date: d(2026, 9, 2),
          activityDescription: 'A',
          durationMinutes: 60,
          projectName: 'Sentinel',
        },
        {
          date: d(2026, 9, 3),
          activityDescription: 'B',
          durationMinutes: 120,
          projectName: 'Sentinel',
        },
        {
          date: d(2026, 9, 3),
          activityDescription: 'C',
          durationMinutes: 30,
          projectName: 'Blip - GAL',
        },
      ],
      2026,
      9
    );

    expect(summarizeTimesheetByProject(rows)).toEqual([
      { projectName: 'Sentinel', durationMinutes: 180 },
      { projectName: 'Blip - GAL', durationMinutes: 30 },
    ]);
  });
});
