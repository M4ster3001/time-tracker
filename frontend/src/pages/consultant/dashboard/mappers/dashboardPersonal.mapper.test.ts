import { describe, expect, it } from 'vitest';
import { buildQuickLogSuggestionsFromEntries } from './dashboardPersonal.mapper';

describe('dashboardPersonal.mapper quick log suggestions', () => {
  it('builds suggestions from real entries ordered by usage and recency', () => {
    const suggestions = buildQuickLogSuggestionsFromEntries(
      [
        {
          id: 1,
          clientId: 10,
          date: '2026-04-08',
          activityDescription: 'Ajuste API',
          durationMinutes: 30,
        },
        {
          id: 2,
          clientId: 10,
          date: '2026-04-09',
          activityDescription: 'ajuste api ',
          durationMinutes: 45,
        },
        {
          id: 3,
          clientId: 10,
          date: '2026-04-10',
          activityDescription: 'Ajuste API',
          durationMinutes: 45,
        },
        {
          id: 4,
          clientId: 11,
          date: '2026-04-10',
          activityDescription: 'Code Review',
          durationMinutes: 30,
        },
      ],
      undefined,
      8
    );

    expect(suggestions[0]).toMatchObject({
      name: 'Ajuste API',
      suggestedDurationMinutes: 45,
      usageCount: 3,
      source: 'global',
    });
    expect(suggestions[1]).toMatchObject({
      name: 'Code Review',
      suggestedDurationMinutes: 30,
      usageCount: 1,
    });
  });

  it('filters by client and only falls back to that client history', () => {
    const suggestions = buildQuickLogSuggestionsFromEntries(
      [
        {
          id: 1,
          clientId: 10,
          date: '2026-04-08',
          activityDescription: 'Ajuste API',
          durationMinutes: 30,
        },
        {
          id: 2,
          clientId: 11,
          date: '2026-04-09',
          activityDescription: 'Code Review',
          durationMinutes: 60,
        },
      ],
      11,
      8
    );

    expect(suggestions).toEqual([
      expect.objectContaining({
        name: 'Code Review',
        suggestedDurationMinutes: 60,
        source: 'client',
      }),
    ]);
  });
});
