/**
 * SRC-01 — associacao autor Git ↔ usuario TT (plano §4.5).
 * Identidade Git nao equivale a identidade autorizada.
 * Nao criar usuario nem assumir horas de terceiros por nome/e-mail Git.
 */

export type GitAuthorMapping = {
  gitEmail: string;
  userId: number;
  /** So vinculos verified resolvem; unverified permanece residual. */
  verified: boolean;
};

export type ResolveGitAuthorResult =
  | { status: 'mapped'; userId: number }
  | { status: 'unmapped' }
  | { status: 'unverified' }
  | { status: 'ambiguous' }
  | { status: 'invalid' };

export const normalizeGitAuthorEmail = (
  raw: string | null | undefined
): string | null => {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) return null;
  return email;
};

/**
 * Resolve userId TT a partir do e-mail do autor Git.
 * Ordem: mapas verified → self-claim (email do ator autenticado) → unmapped.
 */
export const resolveGitAuthorUserId = (input: {
  gitEmail: string | null | undefined;
  actorUserId: number;
  actorEmail: string | null | undefined;
  mappings: GitAuthorMapping[];
}): ResolveGitAuthorResult => {
  const email = normalizeGitAuthorEmail(input.gitEmail);
  if (!email) return { status: 'invalid' };

  const verifiedMatches = input.mappings.filter(
    (row) => row.verified && normalizeGitAuthorEmail(row.gitEmail) === email
  );
  const uniqueUserIds = Array.from(new Set(verifiedMatches.map((row) => row.userId)));
  if (uniqueUserIds.length > 1) return { status: 'ambiguous' };
  if (uniqueUserIds.length === 1) {
    return { status: 'mapped', userId: uniqueUserIds[0]! };
  }

  const hasUnverified = input.mappings.some(
    (row) => !row.verified && normalizeGitAuthorEmail(row.gitEmail) === email
  );
  if (hasUnverified) return { status: 'unverified' };

  const actorEmail = normalizeGitAuthorEmail(input.actorEmail);
  if (actorEmail && actorEmail === email) {
    return { status: 'mapped', userId: input.actorUserId };
  }

  return { status: 'unmapped' };
};

/**
 * authorUserId em EstimationReference:
 * - com identidade Git: so quando mapped (senao null — nao atribui o linker)
 * - sem identidade Git (refs manuais): fallback do ator que vinculou
 */
export const pickEstimationReferenceAuthorUserId = (input: {
  hasGitAuthorIdentity: boolean;
  resolved: ResolveGitAuthorResult;
  fallbackActorUserId?: number | null;
}): number | null => {
  if (input.hasGitAuthorIdentity) {
    return input.resolved.status === 'mapped' ? input.resolved.userId : null;
  }
  return input.fallbackActorUserId ?? null;
};
