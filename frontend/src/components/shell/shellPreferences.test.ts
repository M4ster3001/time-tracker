import { describe, expect, it } from 'vitest';
import { mergeNavOpenGroups } from './shellPreferences';

describe('shellPreferences', () => {
  it('merges stored nav open-group prefs with defaults and ignores unknown keys', () => {
    const defaults = { home: true, settings: false };
    expect(mergeNavOpenGroups(defaults, null)).toEqual(defaults);
    expect(
      mergeNavOpenGroups(defaults, { home: false, settings: true, ghost: true })
    ).toEqual({ home: false, settings: true });
    expect(mergeNavOpenGroups(defaults, { home: 'yes' })).toEqual(defaults);
  });
});
