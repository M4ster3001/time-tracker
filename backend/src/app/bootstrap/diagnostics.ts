import { config } from '../../config.js';
import { logger } from '../../shared/infrastructure/logger/logger.js';
import { getBackupDependencyStatus } from '../../services/backup.service.js';
import { getNotificationStorageStatus } from '../../modules/notifications/application/notification-reminder.service.js';

export const logActiveFeatures = (): void => {
  const flags = [
    `AI: ${config.ai.enabled ? `on (${config.ai.provider})` : 'off'}`,
    `Daily seed: ${config.dailySeed.enabled ? 'on' : 'off'}`,
    `Redis: ${config.redis.enabled ? 'on' : 'off'}`,
    `Backup: ${config.backup.enabled ? `on (${config.backup.providers.join(', ')})` : 'off'}`,
    `Google Calendar: ${config.google.clientId && config.google.clientSecret ? 'on' : 'off'}`,
  ];
  logger.info(`Features: ${flags.join(' · ')}`);
};

export const runBootDiagnostics = async (): Promise<void> => {
  if (config.backup.enabled) {
    const backupDependencies = await getBackupDependencyStatus();
    logger.info(
      `[BOOT] Backup deps: dump=${backupDependencies.dumpCommand ?? 'missing'}:${backupDependencies.dumpCommandAvailable ? 'ok' : 'missing'} path=${backupDependencies.backupPathExists ? 'ok' : 'missing'}`
    );
    if (backupDependencies.details.length > 0) {
      logger.warn(`[BOOT] Backup deps details: ${backupDependencies.details.join(' | ')}`);
    }
  }

  const notificationStatus = await getNotificationStorageStatus();
  if (notificationStatus.ready) {
    logger.info(
      `[BOOT] Notifications storage ready (defaults: ${notificationStatus.defaultTimes.join(', ')})`
    );
  } else {
    logger.warn(
      `[BOOT] Notifications storage missing tables: ${notificationStatus.missingTables.join(', ')}`
    );
  }
};
