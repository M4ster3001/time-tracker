import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { createTimeEntry, withTimeEntryRepository } from '../../time-tracking/application/time-tracking.service.js';
import { PrismaTimeEntryRepository } from '../../time-tracking/infrastructure/repositories/prisma-time-entry.repository.js';
import { AppError } from '../../../app/errors/app-error.js';
import { getFlows, getUserGrants } from '../../access-control/application/access-control.service.js';
import type { Grant } from '../../access-control/domain/permissions.js';

/**
 * Sync delta por timestamp entre o banco local (desktop/SQLite) e o remoto
 * (servidor/MySQL). Cada linha sincronizavel tem um `uuid` estavel; a ordenacao
 * e o desempate de conflitos usam `updatedAt`, com o servidor como autoridade.
 *
 * ESCOPO: o dispositivo so recebe (e so pode enviar) os dados que o usuario do
 * token enxerga no app -- as mesmas regras de time-entry-access.policy:
 *   - Consultor (3): apenas os proprios lancamentos.
 *   - Gerente (2):   os proprios + os dos consultores que ele gerencia.
 *   - Admin (1):     todos.
 * Sem isso, um consultor baixaria dados de toda a empresa para a maquina dele.
 */

export const ROLE_ADMIN = 1;
export const ROLE_MANAGER = 2;

export interface SyncTimeEntryDTO {
  uuid: string;
  userUuid: string;
  clientUuid: string;
  projectUuid?: string | null;
  date: string;
  activityDescription: string;
  durationMinutes: number;
  estimatedDurationMinutes?: number | null;
  confirmedDurationMinutes?: number | null;
  actualTrackedDurationMinutes?: number | null;
  deletedAt?: string | null;
  updatedAt: string;
  baseUpdatedAt?: string | null;
}

export interface PushResult {
  uuid: string;
  status: 'applied' | 'skipped' | 'error';
  reason?: string;
}

/** Ids dos usuarios cujos dados este token pode sincronizar. */
const visibleUserIds = async (userId: number, roleId: number): Promise<number[] | 'all'> => {
  if (roleId === ROLE_ADMIN) return 'all';

  if (roleId === ROLE_MANAGER) {
    const managed = await prisma.user.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    return [userId, ...managed.map((u) => u.id)];
  }

  return [userId];
};

const entryUserFilter = (ids: number[] | 'all') =>
  ids === 'all' ? {} : { userId: { in: ids } };

export const pull = async (userId: number, roleId: number, since?: string, effectiveGrants?: Grant[]) => {
  const serverTime = new Date().toISOString();
  const sinceDate = since ? new Date(since) : new Date(0);
  const ids = await visibleUserIds(userId, roleId);

  const [roles, users, entries] = await Promise.all([
    prisma.role.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({
      where: ids === 'all' ? {} : { id: { in: ids } },
      select: {
        uuid: true,
        name: true,
        email: true,
        roleId: true,
        isActive: true,
        deletedAt: true,
        manager: { select: { uuid: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: { ...entryUserFilter(ids), deletedAt: {}, updatedAt: { gt: sinceDate, lte: new Date(serverTime) } },
      select: {
        uuid: true,
        date: true,
        activityDescription: true,
        durationMinutes: true,
        estimatedDurationMinutes: true,
        confirmedDurationMinutes: true,
        actualTrackedDurationMinutes: true,
        deletedAt: true,
        updatedAt: true,
        user: { select: { uuid: true } },
        client: { select: { uuid: true } },
        project: { select: { uuid: true } },
      },
    }),
  ]);

  // Clientes que os usuarios do escopo enxergam (vinculo direto + os ja usados
  // em lancamentos, para que o historico resolva as referencias).
  const [links, usedByEntries] = await Promise.all([
    prisma.userClient.findMany({
      where: ids === 'all' ? {} : { userId: { in: ids } },
      select: { clientId: true },
    }),
    prisma.timeEntry.findMany({
      where: entryUserFilter(ids),
      select: { clientId: true },
      distinct: ['clientId'],
    }),
  ]);
  const clientIds = [
    ...new Set([...links.map((l) => l.clientId), ...usedByEntries.map((e) => e.clientId)]),
  ];

  const clients = await prisma.client.findMany({
    where: ids === 'all' ? {} : { id: { in: clientIds } },
    select: { uuid: true, name: true, code: true, isActive: true, deletedAt: true },
  });

  // PRJ-01: catalogo de projetos dos clientes visiveis (sync read-only do cadastro).
  const projects = await prisma.project.findMany({
    where: ids === 'all' ? {} : { clientId: { in: clientIds } },
    select: {
      uuid: true,
      code: true,
      name: true,
      description: true,
      state: true,
      updatedAt: true,
      client: { select: { uuid: true } },
      owner: { select: { uuid: true } },
    },
    orderBy: { updatedAt: 'asc' },
  });

  return {
    access: { ...(await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { uuid: true, locale: true } }).then((user) => ({ userUuid: user.uuid, locale: user.locale }))),
      grants: effectiveGrants ?? await getUserGrants(userId), flows: await getFlows() },
    serverTime,
    roles,
    users: users.map((u) => ({
      uuid: u.uuid,
      name: u.name,
      email: u.email,
      roleId: u.roleId,
      managerUuid: u.manager?.uuid ?? null,
      isActive: u.isActive,
      deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
    })),
    clients: clients.map((c) => ({
      uuid: c.uuid,
      name: c.name,
      code: c.code,
      isActive: c.isActive,
      deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
    })),
    projects: projects.map((p) => ({
      uuid: p.uuid,
      clientUuid: p.client.uuid,
      code: p.code,
      name: p.name,
      description: p.description,
      state: p.state,
      ownerUserUuid: p.owner?.uuid ?? null,
      updatedAt: p.updatedAt.toISOString(),
    })),
    timeEntries: entries.map((e) => ({
      uuid: e.uuid,
      userUuid: e.user.uuid,
      clientUuid: e.client.uuid,
      projectUuid: e.project?.uuid ?? null,
      date: e.date.toISOString(),
      activityDescription: e.activityDescription,
      durationMinutes: e.durationMinutes,
      estimatedDurationMinutes: e.estimatedDurationMinutes ?? null,
      confirmedDurationMinutes: e.confirmedDurationMinutes ?? null,
      actualTrackedDurationMinutes: e.actualTrackedDurationMinutes ?? null,
      deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
      updatedAt: e.updatedAt.toISOString(),
    })),
  };
};

/** Mesma regra do assertTimeEntryAccess, aplicada ao dono do lancamento. */
const canWriteFor = async (
  callerId: number,
  callerRoleId: number,
  targetUserId: number,
  targetManagerId: number | null
): Promise<boolean> => {
  if (targetUserId === callerId) return true;
  if (callerRoleId === ROLE_ADMIN) return true;
  if (callerRoleId === ROLE_MANAGER) return targetManagerId === callerId;
  return false;
};

export const push = async (userId: number, roleId: number, entries: SyncTimeEntryDTO[]) => {
  const results: PushResult[] = [];

  for (const entry of entries) {
    try {
      const [owner, client] = await Promise.all([
        prisma.user.findUnique({
          where: { uuid: entry.userUuid },
          select: { id: true, managerId: true },
        }),
        prisma.client.findUnique({ where: { uuid: entry.clientUuid }, select: { id: true, isActive: true, deletedAt: true } }),
      ]);

      if (!owner) {
        results.push({ uuid: entry.uuid, status: 'error', reason: 'usuario nao encontrado' });
        continue;
      }
      if (!client || !client.isActive || client.deletedAt) {
        results.push({ uuid: entry.uuid, status: 'error', reason: 'cliente nao encontrado' });
        continue;
      }
      if (!(await canWriteFor(userId, roleId, owner.id, owner.managerId))) {
        results.push({ uuid: entry.uuid, status: 'skipped', reason: 'sem permissao' });
        continue;
      }

      const existing = await prisma.timeEntry.findUnique({
        where: { uuid: entry.uuid, deletedAt: {} },
      });
      if (existing && existing.userId !== owner.id) {
        results.push({ uuid: entry.uuid, status: 'error', reason: 'SYNC_OWNER_MISMATCH' });
        continue;
      }
      if (existing && Boolean(existing.deletedAt) === Boolean(entry.deletedAt) &&
          (existing.deletedAt || (existing.clientId === client.id &&
            existing.date.toISOString() === entry.date &&
            existing.activityDescription === entry.activityDescription &&
            existing.durationMinutes === entry.durationMinutes))) {
        results.push({ uuid: entry.uuid, status: 'applied', reason: 'UNCHANGED' });
        continue;
      }
      if (existing && (!entry.baseUpdatedAt || existing.deletedAt ||
          existing.updatedAt.toISOString() !== entry.baseUpdatedAt)) {
        results.push({ uuid: entry.uuid, status: 'error', reason: 'SYNC_CONFLICT' });
        continue;
      }
      const data = { clientId: client.id, date: new Date(entry.date),
        activityDescription: entry.activityDescription, durationMinutes: entry.durationMinutes };
      if (!existing) {
        if (entry.deletedAt) {
          results.push({ uuid: entry.uuid, status: 'error', reason: 'SYNC_ENTRY_NOT_FOUND' });
          continue;
        }
        // New sync records are owned by the caller. Privileged corrections use
        // update/delete and must target the actual persisted owner.
        if (owner.id !== userId) {
          results.push({ uuid: entry.uuid, status: 'error', reason: 'SYNC_CANNOT_CREATE_FOR_OTHER_USER' });
          continue;
        }
        await createTimeEntry({ ...data, uuid: entry.uuid, userId, source: 'API' });
      } else {
        const service = withTimeEntryRepository(new PrismaTimeEntryRepository(existing.updatedAt));
        if (entry.deletedAt) await service.deleteTimeEntry(existing.id, userId, roleId);
        else await service.updateTimeEntry(existing.id, userId, data, roleId);
      }

      results.push({ uuid: entry.uuid, status: 'applied' });
    } catch (error) {
      results.push({
        uuid: entry.uuid,
        status: 'error',
        reason: error instanceof AppError ? error.message : 'SYNC_WRITE_FAILED',
      });
    }
  }

  return { serverTime: new Date().toISOString(), results };
};
