import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { ForbiddenError } from '../../../app/errors/app-error.js';
import { getUserGrants } from '../../access-control/application/access-control.service.js';
import { scopeFor, type Scope } from '../../access-control/domain/permissions.js';
import {
  canConfirmEntryForScope,
  partitionConfirmableEntries,
} from '../domain/confirm-duration-access.js';

/**
 * Garante estimates.confirm + escopo self/team/all sobre os donos dos apontamentos.
 * team exige managerId atual (mesmo padrao de time-entry-access.policy).
 * Uso: confirmacao de um unico apontamento (todos os donos listados devem passar).
 */
export const assertCanConfirmDurationForEntryOwners = async (input: {
  actorUserId: number;
  entryOwnerUserIds: number[];
}): Promise<void> => {
  const grants = await getUserGrants(input.actorUserId);
  const confirmScope = scopeFor(grants, 'estimates.confirm');
  if (confirmScope == null) throw new ForbiddenError('Forbidden');

  const uniqueOwners = [...new Set(input.entryOwnerUserIds)];
  const others = uniqueOwners.filter((id) => id !== input.actorUserId);

  const managedIds = new Set<number>();
  if (confirmScope === 'team' && others.length > 0) {
    const managed = await prisma.user.findMany({
      where: { id: { in: others }, managerId: input.actorUserId },
      select: { id: true },
    });
    for (const row of managed) managedIds.add(row.id);
  }

  for (const entryUserId of uniqueOwners) {
    const allowed = canConfirmEntryForScope({
      actorUserId: input.actorUserId,
      entryUserId,
      confirmScope,
      isManagedByActor: managedIds.has(entryUserId),
    });
    if (!allowed) throw new ForbiddenError('Forbidden');
  }
};

export type ConfirmableActivityPartition<T extends { userId: number }> = {
  confirmScope: Scope;
  confirmable: T[];
  skipped: T[];
  partial: boolean;
};

/**
 * Particiona apontamentos de WorkActivity pelo escopo do ator.
 * Retorna Forbidden se nao houver nenhum apontamento confirmavel.
 */
export const resolveConfirmableActivityEntries = async <T extends { userId: number }>(input: {
  actorUserId: number;
  entries: T[];
}): Promise<ConfirmableActivityPartition<T>> => {
  const grants = await getUserGrants(input.actorUserId);
  const confirmScope = scopeFor(grants, 'estimates.confirm');
  if (confirmScope == null) throw new ForbiddenError('Forbidden');

  const uniqueOwners = [...new Set(input.entries.map((e) => e.userId))];
  const others = uniqueOwners.filter((id) => id !== input.actorUserId);

  const managedIds = new Set<number>();
  if (confirmScope === 'team' && others.length > 0) {
    const managed = await prisma.user.findMany({
      where: { id: { in: others }, managerId: input.actorUserId },
      select: { id: true },
    });
    for (const row of managed) managedIds.add(row.id);
  }

  const partition = partitionConfirmableEntries({
    actorUserId: input.actorUserId,
    confirmScope,
    managedUserIds: managedIds,
    entries: input.entries,
  });

  if (partition.confirmable.length === 0) throw new ForbiddenError('Forbidden');

  return {
    confirmScope,
    confirmable: partition.confirmable,
    skipped: partition.skipped,
    partial: partition.partial,
  };
};
