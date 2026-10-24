import { describe, expect, it } from 'vitest';
import { normalizeNotificationTimes } from './notificationPreferences';

describe('notifications utils', () => {
  it('normalizes, deduplicates, and sorts notification times', () => {
    expect(normalizeNotificationTimes(['16:00', '11:00', '11:00', '99:99', ''])).toEqual([
      '11:00',
      '16:00',
    ]);
  });
});
