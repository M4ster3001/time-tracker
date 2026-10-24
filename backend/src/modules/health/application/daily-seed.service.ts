import bcrypt from 'bcryptjs';
import { config } from '../../../config.js';
import { normalizeDateOnly } from '../../../shared/domain/date.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import type { DailySeedRepository } from '../domain/repositories/daily-seed.repository.js';

interface DailySeedRuntimeStatus {
  enabled: boolean;
  running: boolean;
  lastAttemptAt: string | null;
  lastRunAt: string | null;
  lastRunDateKey: string | null;
  lastStatus: 'success' | 'skipped' | 'failed' | null;
  lastError: string | null;
  skippedReason: string | null;
  entriesCreated: number;
  auditLogsCreated: number;
}

const runtimeStatus: DailySeedRuntimeStatus = {
  enabled: config.dailySeed.enabled && config.env !== 'production',
  running: false,
  lastAttemptAt: null,
  lastRunAt: null,
  lastRunDateKey: null,
  lastStatus: null,
  lastError: null,
  skippedReason: null,
  entriesCreated: 0,
  auditLogsCreated: 0,
};

const buildTodayKey = (date = new Date()): string =>
  normalizeDateOnly(date).toISOString().slice(0, 10);

const ensureSeedRun = async (
  todayKey: string,
  repository: DailySeedRepository
): Promise<boolean> => {
  const existing = await repository.findSeedRun('daily');
  if (existing && buildTodayKey(existing.lastRunDate) === todayKey) return false;
  await repository.upsertSeedRun('daily', new Date());
  return true;
};

const pickRandom = <T>(items: T[], count: number): T[] => {
  if (items.length <= count) return items;
  const copy = [...items];
  const result: T[] = [];
  while (result.length < count && copy.length > 0) {
    const index = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(index, 1)[0]);
  }
  return result;
};

const buildDailyEntries = (userId: number, clientIds: number[], date: Date, maxEntries: number) => {
  const activities = [
    'Alinhamento com cliente',
    'Planejamento semanal',
    'Revisao de entregas',
    'Acompanhamento de indicadores',
    'Reuniao de status',
    'Atualizacao de backlog',
  ];
  const entries = [];
  const count = Math.min(maxEntries, Math.max(1, Math.floor(Math.random() * 3) + 1));
  const selectedClients = pickRandom(clientIds, Math.min(clientIds.length, count));
  for (let index = 0; index < selectedClients.length; index += 1) {
    const duration = [60, 90, 120, 180][Math.floor(Math.random() * 4)];
    entries.push({
      userId,
      clientId: selectedClients[index],
      date,
      activityDescription: activities[Math.floor(Math.random() * activities.length)],
      durationMinutes: duration,
    });
  }
  return entries;
};

const buildWorkingDatesInMonth = (now = new Date()): Date[] => {
  const normalized = normalizeDateOnly(now);
  const year = normalized.getUTCFullYear();
  const month = normalized.getUTCMonth();
  const lastDay = normalized.getUTCDate();
  const dates: Date[] = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(Date.UTC(year, month, day));
    const weekday = date.getUTCDay();
    if (weekday >= 1 && weekday <= 5) dates.push(date);
  }
  return dates;
};

const buildAuditLogs = (users: Array<{ id: number; roleId: number }>, maxEntries: number) => {
  const actions = [
    { action: 'LOGIN', endpoint: '/api/auth/login' },
    { action: 'REFRESH', endpoint: '/api/auth/refresh' },
    { action: 'EXPORT_TIME_ENTRIES', endpoint: '/api/export/time-entries' },
    { action: 'UPDATE_CLIENT_LOCK_DAY', endpoint: '/api/clients/:id' },
    { action: 'LINK_CLIENT', endpoint: '/api/users/:id/clients' },
    { action: 'UNLINK_CLIENT', endpoint: '/api/users/:id/clients' },
    { action: 'CREATE_TIME_ENTRY', endpoint: '/api/time-entries' },
    { action: 'BULK_TIME_ENTRY', endpoint: '/api/time-entries/bulk' },
  ];
  const logs = [];
  const count = Math.min(maxEntries, Math.max(8, Math.floor(Math.random() * 20) + 8));
  for (let index = 0; index < count; index += 1) {
    const user = users[Math.floor(Math.random() * users.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    logs.push({
      userId: user?.id ?? null,
      endpoint: action.endpoint,
      action: action.action,
      status: 'success',
      details: `seed:${user?.roleId ?? 'unknown'}`,
    });
  }
  return logs;
};

export const runDailySeedIfNeeded = async (deps: {
  repository: DailySeedRepository;
}): Promise<void> => {
  runtimeStatus.enabled = config.dailySeed.enabled && config.env !== 'production';
  runtimeStatus.lastAttemptAt = new Date().toISOString();
  runtimeStatus.running = true;
  runtimeStatus.lastError = null;
  runtimeStatus.skippedReason = null;
  runtimeStatus.entriesCreated = 0;
  runtimeStatus.auditLogsCreated = 0;

  if (!runtimeStatus.enabled) {
    runtimeStatus.lastStatus = 'skipped';
    runtimeStatus.skippedReason = !config.dailySeed.enabled
      ? 'disabled_by_config'
      : 'disabled_in_production';
    runtimeStatus.running = false;
    return;
  }

  const todayKey = buildTodayKey();
  runtimeStatus.lastRunDateKey = todayKey;
  if (!(await ensureSeedRun(todayKey, deps.repository))) {
    runtimeStatus.lastStatus = 'skipped';
    runtimeStatus.skippedReason = 'already_executed_today';
    runtimeStatus.running = false;
    return;
  }

  try {
    const today = normalizeDateOnly(new Date());
    const consultants = await deps.repository.findActiveConsultants();
    if (consultants.length === 0) {
      runtimeStatus.lastStatus = 'skipped';
      runtimeStatus.skippedReason = 'no_active_consultants';
      runtimeStatus.running = false;
      return;
    }

    const usersForLogs = await deps.repository.findUsersForLogs();
    const workingDates = buildWorkingDatesInMonth(today);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const existingEntries = await deps.repository.findTimeEntriesInRange(monthStart, today);
    const existingByUserDate = new Set(
      existingEntries.map((entry) => `${entry.userId}:${entry.date.toISOString().slice(0, 10)}`)
    );

    const entries: Array<{
      userId: number;
      clientId: number;
      date: Date;
      activityDescription: string;
      durationMinutes: number;
    }> = [];
    const logs = buildAuditLogs(
      usersForLogs,
      Math.max(10, Math.floor(config.dailySeed.maxEntries / 2))
    );

    for (const consultant of consultants) {
      const clientIds = await deps.repository.findUserClientIds(consultant.id);
      if (clientIds.length === 0) continue;
      for (const date of workingDates) {
        const key = `${consultant.id}:${date.toISOString().slice(0, 10)}`;
        if (existingByUserDate.has(key)) continue;
        entries.push(
          ...buildDailyEntries(
            consultant.id,
            clientIds,
            date,
            Math.max(1, Math.floor(config.dailySeed.maxEntries / consultants.length))
          )
        );
        if (entries.length >= config.dailySeed.maxEntries) break;
      }
      if (entries.length >= config.dailySeed.maxEntries) break;
    }

    if (entries.length > 0) {
      await deps.repository.createTimeEntries(entries.slice(0, config.dailySeed.maxEntries));
      runtimeStatus.entriesCreated = Math.min(entries.length, config.dailySeed.maxEntries);
    }

    const activeClients = await deps.repository.findAllClientsByActive(true);
    const inactiveClients = await deps.repository.findAllClientsByActive(false);
    if (activeClients.length > 3 && Math.random() < 0.4) {
      const client = activeClients[Math.floor(Math.random() * activeClients.length)];
      await deps.repository.updateClientActive(client.id, false);
      logs.push({
        userId: usersForLogs[0]?.id ?? null,
        endpoint: `/api/clients/${client.id}`,
        action: 'DEACTIVATE_CLIENT',
        status: 'success',
        details: 'seed:daily',
      });
    } else if (inactiveClients.length > 0 && Math.random() < 0.3) {
      const client = inactiveClients[Math.floor(Math.random() * inactiveClients.length)];
      await deps.repository.updateClientActive(client.id, true);
      logs.push({
        userId: usersForLogs[0]?.id ?? null,
        endpoint: `/api/clients/${client.id}`,
        action: 'ACTIVATE_CLIENT',
        status: 'success',
        details: 'seed:daily',
      });
    }

    if (Math.random() < 0.2) {
      const newClient = await deps.repository.createClient();
      activeClients.push({ id: newClient.id });
      logs.push({
        userId: usersForLogs[0]?.id ?? null,
        endpoint: '/api/clients',
        action: 'CREATE_CLIENT',
        status: 'success',
        details: `seed:daily:${newClient.id}`,
      });
    }

    const activeConsultants = await deps.repository.findConsultantsByActive(true);
    const inactiveConsultants = await deps.repository.findConsultantsByActive(false);
    if (activeConsultants.length > 4 && Math.random() < 0.35) {
      const user = activeConsultants[Math.floor(Math.random() * activeConsultants.length)];
      await deps.repository.updateUserActive(user.id, false);
      logs.push({
        userId: usersForLogs[0]?.id ?? null,
        endpoint: `/api/users/${user.id}`,
        action: 'DEACTIVATE_USER',
        status: 'success',
        details: 'seed:daily',
      });
    } else if (inactiveConsultants.length > 0 && Math.random() < 0.25) {
      const user = inactiveConsultants[Math.floor(Math.random() * inactiveConsultants.length)];
      await deps.repository.updateUserActive(user.id, true);
      logs.push({
        userId: usersForLogs[0]?.id ?? null,
        endpoint: `/api/users/${user.id}`,
        action: 'ACTIVATE_USER',
        status: 'success',
        details: 'seed:daily',
      });
    }

    const demoPassword = process.env.DEMO_SEED_PASSWORD?.trim();
    if (demoPassword && demoPassword.length >= 16 && Math.random() < 0.2) {
      const managers = await deps.repository.findActiveManagers();
      const manager = managers[Math.floor(Math.random() * managers.length)];
      const name = `Demo Consultant ${todayKey}-${Math.floor(Math.random() * 90 + 10)}`;
      const email = `demo.consultant.${todayKey.replace(/-/g, '')}.${Math.floor(Math.random() * 900 + 100)}@example.test`;
      const passwordHash = await bcrypt.hash(demoPassword, 10);
      const newConsultant = await deps.repository.createConsultant({
        name,
        email,
        passwordHash,
        managerId: manager?.id ?? null,
      });
      activeConsultants.push({ id: newConsultant.id });
      logs.push({
        userId: usersForLogs[0]?.id ?? null,
        endpoint: '/api/users',
        action: 'CREATE_USER',
        status: 'success',
        details: `seed:daily:${newConsultant.id}`,
      });
    }

    const activeClientIds = activeClients.map((client) => client.id);
    const activeConsultantIds = activeConsultants.map((user) => user.id);
    const existingLinks = await deps.repository.findUserClientLinks(
      activeConsultantIds,
      activeClientIds
    );

    if (existingLinks.length > 0 && Math.random() < 0.4) {
      const link = existingLinks[Math.floor(Math.random() * existingLinks.length)];
      await deps.repository.unlinkClient(link.userId, link.clientId);
      logs.push({
        userId: usersForLogs[0]?.id ?? null,
        endpoint: `/api/users/${link.userId}/clients/${link.clientId}`,
        action: 'UNLINK_CLIENT',
        status: 'success',
        details: 'seed:daily',
      });
    }

    if (activeClientIds.length > 0 && activeConsultantIds.length > 0 && Math.random() < 0.5) {
      const userId = activeConsultantIds[Math.floor(Math.random() * activeConsultantIds.length)];
      const clientId = activeClientIds[Math.floor(Math.random() * activeClientIds.length)];
      const exists = existingLinks.some(
        (link) => link.userId === userId && link.clientId === clientId
      );
      if (!exists) {
        await deps.repository.linkClient(userId, clientId);
        logs.push({
          userId: usersForLogs[0]?.id ?? null,
          endpoint: `/api/users/${userId}/clients/${clientId}`,
          action: 'LINK_CLIENT',
          status: 'success',
          details: 'seed:daily',
        });
      }
    }

    if (logs.length > 0) {
      await deps.repository.createAuditLogs(logs);
      runtimeStatus.auditLogsCreated = logs.length;
    }

    runtimeStatus.lastStatus = 'success';
    runtimeStatus.lastRunAt = new Date().toISOString();
    runtimeStatus.running = false;
  } catch (error) {
    runtimeStatus.lastStatus = 'failed';
    runtimeStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
    runtimeStatus.running = false;
    logger.error({ err: error }, '[SEED] Daily seed failed');
    throw error;
  }
};

export const getDailySeedRuntimeStatus = (): DailySeedRuntimeStatus => ({ ...runtimeStatus });

export const __testOnly = {
  buildTodayKey,
  buildDailyEntries,
  ensureSeedRun,
  buildWorkingDatesInMonth,
  buildAuditLogs,
};
