import { describe, expect, it } from 'vitest';
import {
  applyQuickLogSuggestion,
  FALLBACK_QUICK_LOG_SUGGESTIONS,
  resolveQuickLogActivityOptions,
} from './quickLogWidget.logic';

describe('quickLogWidget.logic', () => {
  it('uses real suggestions before generic fallback', () => {
    const suggestions = [
      {
        name: 'Ajuste endpoint',
        suggestedDurationMinutes: 45,
        usageCount: 4,
        lastUsedAt: '2026-04-08T12:00:00.000Z',
        source: 'client' as const,
      },
    ];

    expect(resolveQuickLogActivityOptions(suggestions)).toEqual(suggestions);
  });

  it('uses generic fallback only when there is no history', () => {
    expect(resolveQuickLogActivityOptions([])).toEqual(FALLBACK_QUICK_LOG_SUGGESTIONS);
  });

  it('fills suggested duration when there was no manual override', () => {
    const result = applyQuickLogSuggestion({
      activity: '',
      duration: 30,
      customDuration: '',
      hasManualDurationEdit: false,
      suggestion: {
        name: 'Ajuste endpoint',
        suggestedDurationMinutes: 45,
        usageCount: 3,
        lastUsedAt: null,
        source: 'global',
      },
    });

    expect(result).toEqual({
      activity: 'Ajuste endpoint',
      duration: 45,
      customDuration: '',
      hasManualDurationEdit: false,
      selectedSuggestion: 'Ajuste endpoint',
    });
  });

  it('preserves manual duration override when clicking a badge', () => {
    const result = applyQuickLogSuggestion({
      activity: 'Texto livre',
      duration: 90,
      customDuration: '1h 30m',
      hasManualDurationEdit: true,
      suggestion: {
        name: 'Code Review',
        suggestedDurationMinutes: 30,
        usageCount: 2,
        lastUsedAt: null,
        source: 'global',
      },
    });

    expect(result).toEqual({
      activity: 'Code Review',
      duration: 90,
      customDuration: '1h 30m',
      hasManualDurationEdit: false,
      selectedSuggestion: 'Code Review',
    });
  });
});
