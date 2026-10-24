import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { getDesktopSettings, updateDesktopSettings } from './desktop-settings.js';
import { remoteRefresh, remotePull, remotePush } from './remote-client.js';
import type { RemotePullData } from './remote-client.js';
import { isGrant } from '../../access-control/domain/permissions.js';
import { flowKeys } from '../../access-control/application/access-control.service.js';

/**
 * Motor de sincronizacao do desktop (roda no backend local, so em modo desktop).
 * A cada ciclo: renova a sessao remota, empurra os lancamentos alterados
 * localmente e puxa as mudancas do remoto, aplicando no SQLite.
 *
 * O escopo dos dados e definido pelo SERVIDOR (ver sync.service): o desktop
 * recebe apenas o que o usuario logado enxerga -- so os proprios lancamentos
 * (consultor), os da equipe (gerente) ou todos (admin).
 *
 * Os lancamentos puxados sao gravados com SQL cru usando o `updatedAt` do
 * remoto, porque o Prisma sobrescreve campos @updatedAt. Sem isso, o registro
 * recem-chegado pareceria "alterado localmente" e seria reenviado no proximo
 * push -- o "eco". No SQLite o DateTime e INTEGER (epoch ms), entao a
 * comparacao de conflito e numerica.
 */

const ms = (iso: string): number => new Date(iso).getTime();

// Usuarios espelhados apenas como dados (autoria dos lancamentos) nao podem
// logar localmente: recebem um hash que nao corresponde a nenhuma senha.
const NON_LOGIN_HASH = '$2a$10$sync.mirrored.user.cannot.login.locally.000000000000';

let running = false;

export const applyAccess = async (data: RemotePullData, remoteUserUuid: string) => {
  // Unknown/older servers never grant an inherited local Admin role.
  const access = data.access;
  if (!access || access.userUuid !== remoteUserUuid) throw new Error('SYNC_ACCESS_UPGRADE_REQUIRED');
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { uuid: remoteUserUuid } });
    const group = await tx.accessGroup.upsert({ where: { name: `remote:${remoteUserUuid}` },
      create: { name: `remote:${remoteUserUuid}`, description: 'Permissions synchronized from the connected server' },
      update: { isActive: true } });
    await tx.accessMembership.deleteMany({ where: { userId: user.id } });
    await tx.accessGrant.deleteMany({ where: { groupId: group.id } });
    for (const grant of new Map(access.grants.filter(isGrant).map((grant) => [`${grant.permission}:${grant.scope}`, grant])).values()) {
      await tx.accessGrant.create({ data: { ...grant, groupId: group.id } });
    }
    await tx.accessMembership.create({ data: { userId: user.id, groupId: group.id } });
    await tx.user.update({ where: { id: user.id }, data: { accessMode: 'CUSTOM', locale: access.locale === 'en' ? 'en' : 'pt-BR' } });
    for (const key of flowKeys) {
      // Financial ledgers remain authoritative on the server until they have a sync protocol.
      const enabled = !['closing', 'clientHourPool', 'personalHourBank', 'publicRegistration'].includes(key) && access.flows[key] === true;
      await tx.featureSetting.upsert({ where: { key }, create: { key, enabled, updatedBy: user.id }, update: { enabled, updatedBy: user.id } });
    }
  });
};

/**
 * O e-mail e unico no banco. Se ja existe um usuario local com este e-mail mas
 * com outro uuid (ex.: o admin criado no modo autonomo, antes de conectar ao
 * servidor), ele adota a identidade do remoto -- caso contrario o espelhamento
 * tentaria inserir um e-mail duplicado e quebraria.
 */
export const reconcileUserIdentity = async (uuid: string, email: string): Promise<void> => {
  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, uuid: true },
  });
  if (byEmail && byEmail.uuid !== uuid) {
    await prisma.user.update({ where: { id: byEmail.id }, data: { uuid } });
  }
};

/** Espelha os usuarios do escopo; resolve o gerente em 2 passos (FK propria). */
const applyUsers = async (users: RemotePullData['users']): Promise<Map<string, number>> => {
  for (const u of users) {
    await reconcileUserIdentity(u.uuid, u.email);
    await prisma.user.upsert({
      where: { uuid: u.uuid },
      create: {
        uuid: u.uuid,
        name: u.name,
        email: u.email,
        roleId: u.roleId,
        isActive: u.isActive,
        deletedAt: u.deletedAt ? new Date(u.deletedAt) : null,
        passwordHash: NON_LOGIN_HASH,
      },
      // Nao toca no passwordHash: o usuario conectado tem a senha real gravada
      // no connect e precisa dela para o login offline.
      update: {
        name: u.name,
        email: u.email,
        roleId: u.roleId,
        isActive: u.isActive,
        deletedAt: u.deletedAt ? new Date(u.deletedAt) : null,
      },
    });
  }

  const rows = await prisma.user.findMany({
    where: { uuid: { in: users.map((u) => u.uuid) } },
    select: { id: true, uuid: true },
  });
  const idByUuid = new Map(rows.map((r) => [r.uuid, r.id]));

  // 2o passo: agora que todos existem, liga cada um ao seu gerente.
  for (const u of users) {
    const managerId = u.managerUuid ? (idByUuid.get(u.managerUuid) ?? null) : null;
    await prisma.user.update({ where: { uuid: u.uuid }, data: { managerId } });
  }

  return idByUuid;
};

const applyClients = async (clients: RemotePullData['clients']): Promise<Map<string, number>> => {
  for (const c of clients) {
    await prisma.client.upsert({
      where: { uuid: c.uuid },
      create: {
        uuid: c.uuid,
        name: c.name,
        code: c.code,
        isActive: c.isActive,
        deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
      },
      update: {
        name: c.name,
        isActive: c.isActive,
        deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
      },
    });
  }

  const rows = await prisma.client.findMany({
    where: { uuid: { in: clients.map((c) => c.uuid) } },
    select: { id: true, uuid: true },
  });
  return new Map(rows.map((r) => [r.uuid, r.id]));
};

/** Espelha o catalogo de projetos do pull (cadastro; sem push de membership neste incremento). */
const applyProjects = async (
  projects: NonNullable<RemotePullData['projects']>,
  clientIdByUuid: Map<string, number>,
  userIdByUuid: Map<string, number>
): Promise<Map<string, number>> => {
  for (const p of projects) {
    const clientId = clientIdByUuid.get(p.clientUuid);
    if (!clientId) continue;
    const ownerUserId = p.ownerUserUuid ? (userIdByUuid.get(p.ownerUserUuid) ?? null) : null;
    const state = ['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].includes(p.state)
      ? p.state
      : 'ACTIVE';
    await prisma.project.upsert({
      where: { uuid: p.uuid },
      create: {
        uuid: p.uuid,
        clientId,
        code: p.code,
        name: p.name,
        description: p.description,
        state: state as 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED',
        ownerUserId,
      },
      update: {
        name: p.name,
        description: p.description,
        state: state as 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED',
        ownerUserId,
      },
    });
  }

  const rows = await prisma.project.findMany({
    where: { uuid: { in: projects.map((p) => p.uuid) } },
    select: { id: true, uuid: true },
  });
  return new Map(rows.map((r) => [r.uuid, r.id]));
};

const applyTimeEntries = async (
  entries: RemotePullData['timeEntries'],
  userIdByUuid: Map<string, number>,
  clientIdByUuid: Map<string, number>,
  pushedVersions: Map<string, number>
): Promise<number> => {
  const now = Date.now();
  let applied = 0;

  for (const e of entries) {
    const userId = userIdByUuid.get(e.userUuid);
    const clientId = clientIdByUuid.get(e.clientUuid);
    if (!userId || !clientId) continue;

    const projectId = e.projectUuid
      ? (
          await prisma.project.findUnique({
            where: { uuid: e.projectUuid },
            select: { id: true },
          })
        )?.id ?? null
      : null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO time_entries
         (uuid, userId, clientId, projectId, date, activityDescription, durationMinutes,
          estimatedDurationMinutes, confirmedDurationMinutes, actualTrackedDurationMinutes,
          deletedAt, createdAt, updatedAt, syncBaseUpdatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(uuid) DO UPDATE SET
         userId = excluded.userId,
         clientId = excluded.clientId,
         projectId = excluded.projectId,
         date = excluded.date,
         activityDescription = excluded.activityDescription,
         durationMinutes = excluded.durationMinutes,
         estimatedDurationMinutes = excluded.estimatedDurationMinutes,
         confirmedDurationMinutes = excluded.confirmedDurationMinutes,
         actualTrackedDurationMinutes = excluded.actualTrackedDurationMinutes,
         deletedAt = excluded.deletedAt,
         updatedAt = excluded.updatedAt,
         syncBaseUpdatedAt = excluded.syncBaseUpdatedAt
       WHERE time_entries.updatedAt = time_entries.syncBaseUpdatedAt
          OR time_entries.updatedAt = ?`,
      e.uuid,
      userId,
      clientId,
      projectId,
      ms(e.date),
      e.activityDescription,
      e.durationMinutes,
      e.estimatedDurationMinutes ?? null,
      e.confirmedDurationMinutes ?? null,
      e.actualTrackedDurationMinutes ?? null,
      e.deletedAt ? ms(e.deletedAt) : null,
      now,
      ms(e.updatedAt),
      ms(e.updatedAt),
      pushedVersions.get(e.uuid) ?? -1
    );
    applied += 1;
  }

  return applied;
};

/**
 * Tudo que mudou localmente desde o ultimo push. Nao filtra por usuario: o banco
 * local so contem o que o servidor liberou para este token, e o servidor valida
 * a permissao de cada lancamento no push.
 */
const collectLocalChanges = async (pushCursor: Date) => {
  const rows = await prisma.timeEntry.findMany({
    where: { deletedAt: {}, updatedAt: { gt: pushCursor } },
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
      syncBaseUpdatedAt: true,
      user: { select: { uuid: true } },
      client: { select: { uuid: true } },
      project: { select: { uuid: true } },
    },
  });

  return rows.map((r) => ({
    uuid: r.uuid,
    userUuid: r.user.uuid,
    clientUuid: r.client.uuid,
    projectUuid: r.project?.uuid ?? null,
    date: r.date.toISOString(),
    activityDescription: r.activityDescription,
    durationMinutes: r.durationMinutes,
    estimatedDurationMinutes: r.estimatedDurationMinutes ?? null,
    confirmedDurationMinutes: r.confirmedDurationMinutes ?? null,
    actualTrackedDurationMinutes: r.actualTrackedDurationMinutes ?? null,
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
    updatedAt: r.updatedAt.toISOString(),
    baseUpdatedAt: r.syncBaseUpdatedAt?.toISOString() ?? null,
  }));
};

export const runSyncCycle = async (): Promise<{ ok: boolean; reason?: string }> => {
  const settings = getDesktopSettings();
  if (!settings.remoteUrl || !settings.remoteRefreshToken) {
    return { ok: false, reason: 'nao conectado' };
  }
  if (running) return { ok: false, reason: 'em andamento' };
  running = true;

  const cycleStart = new Date();
  updateDesktopSettings({ lastSyncStatus: 'syncing', lastSyncError: null });

  try {
    const session = await remoteRefresh(settings.remoteUrl, settings.remoteRefreshToken);
    if (session.refreshToken && session.refreshToken !== settings.remoteRefreshToken) {
      updateDesktopSettings({ remoteRefreshToken: session.refreshToken });
    }

    // PUSH: o que mudou localmente desde o ultimo cursor.
    const pushCursor = settings.pushCursor ? new Date(settings.pushCursor) : new Date(0);
    const localChanges = await collectLocalChanges(pushCursor);
    if (localChanges.length > 0) {
      const pushed = await remotePush(settings.remoteUrl, session.accessToken, localChanges);
      const failed = pushed.results.filter((result) => result.status !== 'applied');
      if (failed.length || pushed.results.length !== localChanges.length) {
        throw new Error(`SYNC_REVIEW_REQUIRED: ${failed.length || localChanges.length} entries were not accepted. Local changes were preserved.`);
      }
    }

    // PULL: o que mudou no remoto (ja limitado ao escopo do usuario pelo servidor).
    const data = await remotePull(settings.remoteUrl, session.accessToken, settings.syncCursor);
    const userIdByUuid = await applyUsers(data.users);
    await applyAccess(data, session.user.uuid);
    const clientIdByUuid = await applyClients(data.clients);
    if (data.projects && data.projects.length > 0) {
      await applyProjects(data.projects, clientIdByUuid, userIdByUuid);
    }
    const applied = await applyTimeEntries(data.timeEntries, userIdByUuid, clientIdByUuid,
      new Map(localChanges.map((entry) => [entry.uuid, ms(entry.updatedAt)])));

    updateDesktopSettings({
      syncCursor: data.serverTime,
      pushCursor: cycleStart.toISOString(),
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: 'ok',
      lastSyncError: null,
    });

    logger.info(
      `[SYNC] ciclo ok: push=${localChanges.length} pull=${applied} usuarios=${data.users.length} clientes=${data.clients.length}`
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    const offline = /fetch failed|ECONNREFUSED|ENOTFOUND|network|timeout/i.test(message);
    updateDesktopSettings({
      lastSyncStatus: offline ? 'offline' : 'error',
      lastSyncError: message,
    });
    logger.warn(`[SYNC] ciclo falhou (${offline ? 'offline' : 'erro'}): ${message}`);
    return { ok: false, reason: message };
  } finally {
    running = false;
  }
};

let timer: NodeJS.Timeout | null = null;

export const startSyncLoop = (intervalMs = 30000): void => {
  if (timer) return;
  setTimeout(() => void runSyncCycle(), 4000);
  timer = setInterval(() => void runSyncCycle(), intervalMs);
  logger.info(`[SYNC] loop iniciado (intervalo ${intervalMs}ms)`);
};

export const stopSyncLoop = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
