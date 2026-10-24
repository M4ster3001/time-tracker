/** PRJ-01 — helpers de UI para memberships de projeto (workspace). */

export type ProjectMembershipRole = 'MEMBER' | 'LEAD';

export type ProjectMembershipRow = {
  userId: number;
  role: string;
  user?: { id: number; name: string; email: string } | null;
};

export const PROJECT_MEMBERSHIP_ROLE_OPTIONS: ProjectMembershipRole[] = ['MEMBER', 'LEAD'];

export const isProjectMembershipRole = (value: string): value is ProjectMembershipRole =>
  value === 'MEMBER' || value === 'LEAD';

export const normalizeMembershipRoleForUi = (raw: string): ProjectMembershipRole => {
  const normalized = raw.trim().toUpperCase();
  if (isProjectMembershipRole(normalized)) return normalized;
  return 'MEMBER';
};

/** Ordena LEAD antes de MEMBER, depois por nome/email. */
export const sortProjectMembershipsForDisplay = (
  rows: ProjectMembershipRow[]
): ProjectMembershipRow[] =>
  [...rows].sort((a, b) => {
    const roleRank = (role: string) => (normalizeMembershipRoleForUi(role) === 'LEAD' ? 0 : 1);
    const byRole = roleRank(a.role) - roleRank(b.role);
    if (byRole !== 0) return byRole;
    const left = a.user?.name || a.user?.email || String(a.userId);
    const right = b.user?.name || b.user?.email || String(b.userId);
    return left.localeCompare(right);
  });

export const membershipDisplayName = (row: ProjectMembershipRow): string =>
  row.user?.name?.trim() || row.user?.email?.trim() || `#${row.userId}`;

export const usersEligibleForMembership = <T extends { id: number }>(
  users: T[],
  memberships: ProjectMembershipRow[]
): T[] => {
  const taken = new Set(memberships.map((m) => m.userId));
  return users.filter((u) => !taken.has(u.id));
};
