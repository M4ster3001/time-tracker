/**
 * PRJ-01 — membership de projeto (plano §5.1).
 * Vinculo a projeto nao concede acesso implicito a outros projetos/clientes.
 */

export const PROJECT_MEMBERSHIP_ROLES = ['MEMBER', 'LEAD'] as const;

export type ProjectMembershipRole = (typeof PROJECT_MEMBERSHIP_ROLES)[number];

export const normalizeProjectMembershipRole = (raw: string): ProjectMembershipRole => {
  const normalized = raw.trim().toUpperCase();
  if ((PROJECT_MEMBERSHIP_ROLES as readonly string[]).includes(normalized)) {
    return normalized as ProjectMembershipRole;
  }
  throw new Error('PROJECT_MEMBERSHIP_ROLE_INVALID');
};

export const assertProjectMembershipRole = (raw: string): ProjectMembershipRole =>
  normalizeProjectMembershipRole(raw);

/** Membership so concede escrita de cadastro quando LEAD; MEMBER e leitura. */
export const canWriteViaProjectMembership = (role: ProjectMembershipRole): boolean =>
  role === 'LEAD';
