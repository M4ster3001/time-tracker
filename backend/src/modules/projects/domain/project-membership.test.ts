import { describe, expect, it } from 'vitest';
import {
  PROJECT_MEMBERSHIP_ROLES,
  assertProjectMembershipRole,
  canWriteViaProjectMembership,
  normalizeProjectMembershipRole,
} from './project-membership.js';

describe('PRJ-01 project memberships', () => {
  it('catalogo de papeis e estavel', () => {
    expect(PROJECT_MEMBERSHIP_ROLES).toEqual(['MEMBER', 'LEAD']);
  });

  it('normaliza e rejeita papel invalido', () => {
    expect(normalizeProjectMembershipRole('lead')).toBe('LEAD');
    expect(normalizeProjectMembershipRole('MEMBER')).toBe('MEMBER');
    expect(() => assertProjectMembershipRole('ADMIN')).toThrow(/PROJECT_MEMBERSHIP_ROLE_INVALID/);
  });

  it('LEAD e MEMBER autorizam leitura; so LEAD implica write via membership', () => {
    expect(canWriteViaProjectMembership('LEAD')).toBe(true);
    expect(canWriteViaProjectMembership('MEMBER')).toBe(false);
  });
});
