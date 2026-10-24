import { describe, expect, it } from 'vitest';
import { computeLiveSessionElapsedMinutes, formatSessionClock } from './trackingElapsed';

describe('computeLiveSessionElapsedMinutes', () => {
  const base = new Date('2026-10-15T12:00:00.000Z');

  it('returns null when there is no open session', () => {
    expect(computeLiveSessionElapsedMinutes(null, base)).toBeNull();
    expect(
      computeLiveSessionElapsedMinutes(
        {
          state: 'STOPPED',
          startedAt: '2026-10-15T11:00:00.000Z',
          accumulatedPausedMs: 0,
        },
        base
      )
    ).toBeNull();
  });

  it('counts running elapsed without counting pauses already accumulated', () => {
    const minutes = computeLiveSessionElapsedMinutes(
      {
        state: 'RUNNING',
        startedAt: '2026-10-15T11:00:00.000Z',
        accumulatedPausedMs: 5 * 60_000,
        pausedAt: null,
      },
      base
    );
    // 60 minutes wall - 5 paused = 55
    expect(minutes).toBe(55);
  });

  it('freezes elapsed while paused', () => {
    const minutes = computeLiveSessionElapsedMinutes(
      {
        state: 'PAUSED',
        startedAt: '2026-10-15T11:00:00.000Z',
        pausedAt: '2026-10-15T11:30:00.000Z',
        accumulatedPausedMs: 0,
      },
      base
    );
    expect(minutes).toBe(30);
  });
});

describe('formatSessionClock', () => {
  it('formats hh:mm and placeholder', () => {
    expect(formatSessionClock(null)).toBe('—');
    expect(formatSessionClock(75)).toBe('01:15');
    expect(formatSessionClock(5)).toBe('00:05');
  });
});
