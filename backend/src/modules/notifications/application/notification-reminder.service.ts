import type { INotificationPreference, IPendingReminder } from '../domain/notification-preference.types.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../app/errors/app-error.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { isDesktopRuntime } from '../../../shared/infrastructure/runtime/app-runtime.js';
import { formatDateKeyUTC, normalizeDateOnlyUTC } from '../../../services/date/utc-date.service.js';
import type {
  ClientRow,
  NotificationRepository,
  PreferenceRow,
} from '../domain/repositories/notification.repository.js';
import { notificationRepository as defaultRepository } from '../infrastructure/repositories/prisma-notification.repository.js';

const DEFAULT_NOTIFICATION_TIMES = ['11:00', '16:00'];
const DEFAULT_SNOOZE_MINUTES = 30;
const MIN_SNOOZE_MINUTES = 5;
const MAX_SNOOZE_MINUTES = 240;
const MAX_NOTIFICATION_TIMES = 6;
const ELIGIBLE_ROLE_IDS = new Set([1, 2, 3]);
const NOTIFICATION_TABLES = ['user_notification_preferences', 'notification_reminders'] as const;

export interface NotificationStorageStatus {
  ready: boolean;
  missingTables: string[];
  defaultTimes: string[];
  defaultSnoozeMinutes: number;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const getLocalNowParts = (
  reference = new Date()
): {
  now: Date;
  todayUtc: Date;
  dateKey: string;
  timeKey: string;
} => {
  const year = reference.getFullYear();
  const month = reference.getMonth() + 1;
  const day = reference.getDate();
  const hours = String(reference.getHours()).padStart(2, '0');
  const minutes = String(reference.getMinutes()).padStart(2, '0');

  return {
    now: reference,
    todayUtc: normalizeDateOnlyUTC(new Date(Date.UTC(year, month - 1, day))),
    dateKey: formatDateKeyUTC(new Date(Date.UTC(year, month - 1, day))),
    timeKey: `${hours}:${minutes}`,
  };
};

const normalizePreferenceTimes = (times: string[]): string[] => {
  const normalized = Array.from(
    new Set(times.map((time) => time.trim()).filter((time) => TIME_PATTERN.test(time)))
  ).sort();

  if (normalized.length === 0) {
    throw new BadRequestError('At least one notification time is required');
  }
  if (normalized.length > MAX_NOTIFICATION_TIMES) {
    throw new BadRequestError(`Notification times cannot exceed ${MAX_NOTIFICATION_TIMES}`);
  }

  return normalized;
};

export const getNotificationStorageStatus = async (
  repository: NotificationRepository = defaultRepository
): Promise<NotificationStorageStatus> => {
  if (isDesktopRuntime()) {
    return {
      ready: false,
      missingTables: [...NOTIFICATION_TABLES],
      defaultTimes: [...DEFAULT_NOTIFICATION_TIMES],
      defaultSnoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    };
  }

  try {
    const present = await repository.findExistingTables(NOTIFICATION_TABLES);
    const missingTables = NOTIFICATION_TABLES.filter((table) => !present.has(table));
    return {
      ready: missingTables.length === 0,
      missingTables,
      defaultTimes: [...DEFAULT_NOTIFICATION_TIMES],
      defaultSnoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    };
  } catch (error) {
    logger.warn({ err: error }, '[NOTIFICATIONS] Failed to inspect storage status');
    return {
      ready: false,
      missingTables: [...NOTIFICATION_TABLES],
      defaultTimes: [...DEFAULT_NOTIFICATION_TIMES],
      defaultSnoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    };
  }
};

const assertNotificationStorageReady = async (
  repository: NotificationRepository
): Promise<NotificationStorageStatus> => {
  const status = await getNotificationStorageStatus(repository);
  if (!status.ready) {
    throw new BadRequestError(
      `Notification storage is not ready. Missing tables: ${status.missingTables.join(', ')}`
    );
  }
  return status;
};

const mapPreferenceRow = (row?: PreferenceRow | null): INotificationPreference => {
  if (!row) {
    return {
      enabled: false,
      times: [...DEFAULT_NOTIFICATION_TIMES],
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    };
  }

  let times = [...DEFAULT_NOTIFICATION_TIMES];
  try {
    const parsed = JSON.parse(row.timesJson) as unknown;
    if (Array.isArray(parsed)) {
      times = normalizePreferenceTimes(
        parsed.filter((item): item is string => typeof item === 'string')
      );
    }
  } catch (_error) {
    times = [...DEFAULT_NOTIFICATION_TIMES];
  }

  return {
    enabled: row.enabled,
    times,
    snoozeMinutes: row.snoozeMinutes,
  };
};

const assertEligibleUser = async (
  userId: number,
  repository: NotificationRepository
): Promise<void> => {
  const user = await repository.findEligibleUser(userId);

  if (!user || !user.isActive) {
    throw new ForbiddenError('Notifications are only available for active users');
  }
  if (!ELIGIBLE_ROLE_IDS.has(user.roleId)) {
    throw new ForbiddenError('Notifications are only available for managers and consultants');
  }
};

const getPreference = async (
  userId: number,
  repository: NotificationRepository
): Promise<INotificationPreference> => {
  const row = await repository.findPreferenceRow(userId);
  return mapPreferenceRow(row);
};

const fetchCurrentAllocatedClients = async (
  userId: number,
  todayUtc: Date,
  repository: NotificationRepository
): Promise<ClientRow[]> => {
  const activeLinkedClients = await repository.findActiveLinkedClients(userId);

  if (activeLinkedClients.length === 0) {
    return [];
  }

  const allocatedClientIdList = await repository.findAllocatedClientIds(
    userId,
    activeLinkedClients.map((client) => client.id),
    todayUtc
  );

  const allocatedClientIds = new Set(allocatedClientIdList);
  return activeLinkedClients.filter((client) => allocatedClientIds.has(client.id));
};

export const getNotificationPreferences = async (
  userId: number,
  repository: NotificationRepository = defaultRepository
): Promise<INotificationPreference> => {
  await assertEligibleUser(userId, repository);
  const storageStatus = await getNotificationStorageStatus(repository);
  if (!storageStatus.ready) {
    return {
      enabled: false,
      times: storageStatus.defaultTimes,
      snoozeMinutes: storageStatus.defaultSnoozeMinutes,
    };
  }
  return getPreference(userId, repository);
};

export const updateNotificationPreferences = async (
  userId: number,
  input: Partial<INotificationPreference>,
  repository: NotificationRepository = defaultRepository
): Promise<INotificationPreference> => {
  await assertEligibleUser(userId, repository);
  await assertNotificationStorageReady(repository);

  const current = await getPreference(userId, repository);
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : current.enabled;
  const times = input.times ? normalizePreferenceTimes(input.times) : current.times;
  const snoozeMinutes =
    typeof input.snoozeMinutes === 'number'
      ? Math.round(input.snoozeMinutes)
      : current.snoozeMinutes;

  if (!Number.isFinite(snoozeMinutes)) {
    throw new BadRequestError('Snooze minutes must be a valid number');
  }
  if (snoozeMinutes < MIN_SNOOZE_MINUTES || snoozeMinutes > MAX_SNOOZE_MINUTES) {
    throw new BadRequestError(
      `Snooze minutes must be between ${MIN_SNOOZE_MINUTES} and ${MAX_SNOOZE_MINUTES}`
    );
  }

  await repository.upsertPreferenceRow(userId, enabled, JSON.stringify(times), snoozeMinutes);

  return { enabled, times, snoozeMinutes };
};

export const listPendingNotificationReminders = async (
  userId: number,
  repository: NotificationRepository = defaultRepository
): Promise<IPendingReminder[]> => {
  await assertEligibleUser(userId, repository);
  const storageStatus = await getNotificationStorageStatus(repository);
  if (!storageStatus.ready) {
    return [];
  }

  const preference = await getPreference(userId, repository);
  if (!preference.enabled) return [];

  const { now, todayUtc, dateKey, timeKey } = getLocalNowParts();
  const activeClients = await fetchCurrentAllocatedClients(userId, todayUtc, repository);
  if (activeClients.length === 0) return [];

  const clientIds = activeClients.map((client) => client.id);
  const entryTotals = await repository.sumWorkedMinutesByClient(userId, clientIds, todayUtc);

  const workedMinutesByClient = new Map<number, number>();
  entryTotals.forEach((row) => {
    workedMinutesByClient.set(row.clientId, row._sum.durationMinutes ?? 0);
  });
  const workedClientIds = new Set(
    [...workedMinutesByClient.entries()]
      .filter(([, minutes]) => minutes > 0)
      .map(([clientId]) => clientId)
  );

  await repository.markRemindersCompleted(userId, todayUtc, [...workedClientIds]);

  const existingRows = await repository.findReminders(userId, todayUtc, clientIds);

  const existingByKey = new Map<string, (typeof existingRows)[number]>();
  existingRows.forEach((row) => {
    existingByKey.set(`${row.clientId}:${row.scheduledTime}`, row);
  });

  const pending: IPendingReminder[] = [];

  for (const scheduledTime of preference.times) {
    if (scheduledTime > timeKey) continue;

    for (const client of activeClients) {
      if ((workedMinutesByClient.get(client.id) ?? 0) > 0) {
        continue;
      }

      const key = `${client.id}:${scheduledTime}`;
      const existing = existingByKey.get(key);

      if (!existing) {
        await repository.createReminder(userId, client.id, todayUtc, scheduledTime);

        const created = await repository.findReminder(userId, client.id, todayUtc, scheduledTime);
        if (created) {
          pending.push({
            id: created.id,
            clientId: client.id,
            clientName: client.name,
            date: dateKey,
            scheduledTime,
            missingMinutes: 1,
            status: 'pending',
            launchUrl: `/time-entries/new?clientId=${client.id}`,
          });
        }
        continue;
      }

      if (existing.status === 'DISMISSED' || existing.status === 'COMPLETED') {
        continue;
      }

      if (existing.status === 'SNOOZED') {
        if (existing.snoozedUntil && existing.snoozedUntil.getTime() > now.getTime()) {
          continue;
        }
        await repository.reactivateSnoozedReminder(existing.id);
        pending.push({
          id: existing.id,
          clientId: client.id,
          clientName: client.name,
          date: dateKey,
          scheduledTime,
          missingMinutes: 1,
          status: 'snoozed',
          launchUrl: `/time-entries/new?clientId=${client.id}`,
        });
        continue;
      }

      if (!existing.triggeredAt) {
        await repository.markReminderTriggered(existing.id);
        pending.push({
          id: existing.id,
          clientId: client.id,
          clientName: client.name,
          date: dateKey,
          scheduledTime,
          missingMinutes: 1,
          status: 'pending',
          launchUrl: `/time-entries/new?clientId=${client.id}`,
        });
      }
    }
  }

  return pending.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
};

const getReminderById = async (
  userId: number,
  reminderId: number,
  repository: NotificationRepository
) => {
  const reminder = await repository.findReminderById(userId, reminderId);
  if (!reminder) {
    throw new NotFoundError('Notification reminder not found');
  }
  return reminder;
};

export const dismissNotificationReminder = async (
  userId: number,
  reminderId: number,
  repository: NotificationRepository = defaultRepository
): Promise<void> => {
  await assertEligibleUser(userId, repository);
  await assertNotificationStorageReady(repository);
  await getReminderById(userId, reminderId, repository);

  await repository.dismissReminder(reminderId);
};

export const snoozeNotificationReminder = async (
  userId: number,
  reminderId: number,
  minutes: number | undefined,
  repository: NotificationRepository = defaultRepository
): Promise<void> => {
  await assertEligibleUser(userId, repository);
  await assertNotificationStorageReady(repository);
  await getReminderById(userId, reminderId, repository);
  const preference = await getPreference(userId, repository);
  const snoozeMinutes =
    typeof minutes === 'number' ? Math.round(minutes) : preference.snoozeMinutes;

  if (snoozeMinutes < MIN_SNOOZE_MINUTES || snoozeMinutes > MAX_SNOOZE_MINUTES) {
    throw new BadRequestError(
      `Snooze minutes must be between ${MIN_SNOOZE_MINUTES} and ${MAX_SNOOZE_MINUTES}`
    );
  }

  await repository.snoozeReminder(reminderId, new Date(Date.now() + snoozeMinutes * 60 * 1000));
};
