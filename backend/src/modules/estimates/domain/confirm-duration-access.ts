/**
 * EST-02 — quem pode confirmar duracao de terceiros.
 * Alinhado ao plano §10 e a scope de `estimates.confirm` (nao a roleId solta).
 * - self: so o dono do apontamento
 * - team: dono + usuarios com managerId = ator (mesmo criterio de time-entry-access)
 * - all: qualquer apontamento
 * WorkActivity.ownerUserId sozinho nao autoriza confirmar horas de outrem.
 *
 * Atividade multi-user: confirmar apenas o subconjunto autorizado (parcial),
 * em vez de exigir todos os donos de uma vez.
 */

import type { Scope } from '../../access-control/domain/permissions.js';

export const canConfirmEntryForScope = (input: {
  actorUserId: number;
  entryUserId: number;
  confirmScope: Scope | null;
  isManagedByActor: boolean;
}): boolean => {
  if (input.confirmScope == null) return false;
  if (input.entryUserId === input.actorUserId) return true;
  if (input.confirmScope === 'all') return true;
  if (input.confirmScope === 'team') return input.isManagedByActor;
  return false;
};

export type ConfirmableEntryPartition<T extends { userId: number }> = {
  confirmable: T[];
  skipped: T[];
  partial: boolean;
};

/** Particiona apontamentos de uma WorkActivity pelo escopo do ator. */
export const partitionConfirmableEntries = <T extends { userId: number }>(input: {
  actorUserId: number;
  confirmScope: Scope | null;
  managedUserIds: ReadonlySet<number>;
  entries: T[];
}): ConfirmableEntryPartition<T> => {
  const confirmable: T[] = [];
  const skipped: T[] = [];
  for (const entry of input.entries) {
    const allowed = canConfirmEntryForScope({
      actorUserId: input.actorUserId,
      entryUserId: entry.userId,
      confirmScope: input.confirmScope,
      isManagedByActor: input.managedUserIds.has(entry.userId),
    });
    if (allowed) confirmable.push(entry);
    else skipped.push(entry);
  }
  return {
    confirmable,
    skipped,
    partial: skipped.length > 0 && confirmable.length > 0,
  };
};
