import { config } from '../../config.js';
import { logger } from '../../shared/infrastructure/logger/logger.js';
import { initBackupScheduler } from '../../services/backup.service.js';
import { runDataRetentionCleanup } from '../../services/data-retention.service.js';
import { runDailySeedIfNeeded } from '../../services/daily-seed.service.js';

const DATA_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

const scheduleDataRetention = (): void => {
  setTimeout(() => {
    runDataRetentionCleanup().catch((error) => {
      logger.error({ err: error }, '[DATA_RETENTION] Scheduled cleanup failed');
    });
  }, 5000);

  setInterval(() => {
    runDataRetentionCleanup().catch((error) => {
      logger.error({ err: error }, '[DATA_RETENTION] Scheduled cleanup failed');
    });
  }, DATA_RETENTION_INTERVAL_MS);
};

export const startBackgroundJobs = async (): Promise<void> => {
  if (!config.desktopMode) {
    await runDailySeedIfNeeded();
  }

  if (config.backup.enabled) {
    initBackupScheduler();
  }

  if (!config.desktopMode) {
    await runDataRetentionCleanup();
    scheduleDataRetention();
    logger.info('Data retention cleanup scheduled (every 24h)');
    return;
  }

  logger.info('[BOOT] Desktop runtime detected, skipping server-only background jobs');

  // Motor de sincronizacao local <-> remoto (so roda se ha remoto conectado).
  const { startSyncLoop } = await import('../../modules/sync/application/sync-engine.js');
  startSyncLoop();
};
