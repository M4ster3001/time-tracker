import { describe, expect, it } from 'vitest';
import {
  membershipDisplayName,
  normalizeMembershipRoleForUi,
  sortProjectMembershipsForDisplay,
  usersEligibleForMembership,
} from './projectMembershipUi';

describe('PRJ-01 project membership UI helpers', () => {
  it('normaliza papel invalido para MEMBER', () => {
    expect(normalizeMembershipRoleForUi('lead')).toBe('LEAD');
    expect(normalizeMembershipRoleForUi('ADMIN')).toBe('MEMBER');
  });

  it('ordena LEAD antes de MEMBER e por nome', () => {
    const sorted = sortProjectMembershipsForDisplay([
      { userId: 2, role: 'MEMBER', user: { id: 2, name: 'Zoe', email: 'z@x' } },
      { userId: 1, role: 'LEAD', user: { id: 1, name: 'Ana', email: 'a@x' } },
      { userId: 3, role: 'MEMBER', user: { id: 3, name: 'Bob', email: 'b@x' } },
    ]);
    expect(sorted.map((r) => r.userId)).toEqual([1, 3, 2]);
  });

  it('display name prefere nome, depois email, depois id', () => {
    expect(
      membershipDisplayName({
        userId: 9,
        role: 'MEMBER',
        user: { id: 9, name: '  ', email: 'u@x' },
      })
    ).toBe('u@x');
    expect(membershipDisplayName({ userId: 9, role: 'MEMBER' })).toBe('#9');
  });

  it('elegiveis excluem quem ja e membro', () => {
    expect(
      usersEligibleForMembership(
        [
          { id: 1 },
          { id: 2 },
          { id: 3 },
        ],
        [{ userId: 2, role: 'MEMBER' }]
      ).map((u) => u.id)
    ).toEqual([1, 3]);
  });
});
