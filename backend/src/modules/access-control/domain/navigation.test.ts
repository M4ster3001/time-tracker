import { describe, expect, it } from 'vitest';
import { legacyGrants } from './permissions.js';
import { navigationFor } from './navigation.js';

const flowsOff = { calendar: false, tokens: false };
const pathsOf = (roleId: number, opts?: { dualConsultantIntent?: boolean }) =>
  navigationFor(legacyGrants(roleId), flowsOff, false, {
    roleId,
    ...opts,
  }).map((entry) => entry.path);

describe('navigationFor admin self-operator filter', () => {
  it('hides personal time-entry operator paths for pure admin (roleId 1)', () => {
    const paths = pathsOf(1);
    expect(paths).not.toContain('/time-entries');
    expect(paths).not.toContain('/time-entries/new');
    expect(paths).not.toContain('/time-entries/bulk');
    expect(paths).toContain('/time-entries/corrections');
  });

  it('keeps corrections and does not strip admin directory/settings hubs for roleId 1', () => {
    const paths = pathsOf(1);
    expect(paths).toContain('/time-entries/corrections');
    // directory/settings entries collapse to destination hubs in navigationFor
    expect(paths).toContain('/people');
    expect(paths).toContain('/settings');
  });

  it('keeps consultant self-operator time paths (roleId 3)', () => {
    const paths = pathsOf(3);
    expect(paths).toContain('/time-entries');
    expect(paths).toContain('/time-entries/new');
    expect(paths).toContain('/time-entries/bulk');
    expect(paths).not.toContain('/time-entries/corrections');
  });

  it('keeps manager self-operator time paths and team corrections (roleId 2)', () => {
    const paths = pathsOf(2);
    expect(paths).toContain('/time-entries');
    expect(paths).toContain('/time-entries/new');
    expect(paths).toContain('/time-entries/bulk');
    expect(paths).toContain('/time-entries/corrections');
  });

  it('keeps self-operator paths when admin has dual consultant intent', () => {
    const paths = pathsOf(1, { dualConsultantIntent: true });
    expect(paths).toContain('/time-entries');
    expect(paths).toContain('/time-entries/new');
    expect(paths).toContain('/time-entries/bulk');
    expect(paths).toContain('/time-entries/corrections');
  });

  it('does not filter when roleId is omitted (backward compatible)', () => {
    const paths = navigationFor(legacyGrants(1), flowsOff, false).map((e) => e.path);
    expect(paths).toContain('/time-entries/new');
    expect(paths).toContain('/time-entries/corrections');
  });
});
