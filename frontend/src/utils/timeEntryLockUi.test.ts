import { describe, expect, it } from 'vitest';
import { canPrivilegedCorrectLockedEntry, isLockBlockingEdit } from './timeEntryLockUi';

describe('timeEntryLockUi', () => {
  describe('canPrivilegedCorrectLockedEntry', () => {
    it('returns false when not editing', () => {
      expect(canPrivilegedCorrectLockedEntry(false, { id: 1, roleId: 1 }, 2)).toBe(false);
    });

    it('returns false for owner even if admin/manager', () => {
      expect(canPrivilegedCorrectLockedEntry(true, { id: 1, roleId: 1 }, 1)).toBe(false);
      expect(canPrivilegedCorrectLockedEntry(true, { id: 1, roleId: 2 }, 1)).toBe(false);
    });

    it('returns true for admin editing other user entry', () => {
      expect(canPrivilegedCorrectLockedEntry(true, { id: 1, roleId: 1 }, 99)).toBe(true);
    });

    it('returns true for manager editing other user entry', () => {
      expect(canPrivilegedCorrectLockedEntry(true, { id: 2, roleId: 2 }, 99)).toBe(true);
    });

    it('returns false for consultant role', () => {
      expect(canPrivilegedCorrectLockedEntry(true, { id: 3, roleId: 3 }, 99)).toBe(false);
    });
  });

  describe('isLockBlockingEdit', () => {
    it('returns true when locked without temporary unlock and without privileged correction', () => {
      expect(isLockBlockingEdit({ locked: true, lockDay: 26, temporaryUnlock: false }, false)).toBe(
        true
      );
    });

    it('returns false when locked but temporary unlock is active', () => {
      expect(isLockBlockingEdit({ locked: true, lockDay: 26, temporaryUnlock: true }, false)).toBe(
        false
      );
    });

    it('returns false when privileged correction is active', () => {
      expect(isLockBlockingEdit({ locked: true, lockDay: 26, temporaryUnlock: false }, true)).toBe(
        false
      );
    });

    it('returns false when not locked', () => {
      expect(
        isLockBlockingEdit({ locked: false, lockDay: 26, temporaryUnlock: false }, false)
      ).toBe(false);
    });
  });
});
