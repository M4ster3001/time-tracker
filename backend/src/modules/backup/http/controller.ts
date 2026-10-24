import type { Request, Response } from 'express';
import { config } from '../../../config.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { getBackupStatus, triggerManualBackup } from '../application/backup.service.js';
import { backupAuditRepository, createBackupProviders } from '../index.js';

export const getBackupStatusController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await getBackupStatus();
    res.json(status);
  } catch (error) {
    logger.error({ err: error }, '[BACKUP] Error getting status');
    res.status(500).json({
      error: 'Failed to get backup status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const triggerBackupController = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!config.backup.enabled) {
      res.status(503).json({
        error: 'Backup service is disabled',
        message: 'Enable backups by setting BACKUP_ENABLED=true',
      });
      return;
    }

    const result = await triggerManualBackup({
      auditRepository: backupAuditRepository,
      providersFactory: createBackupProviders,
    });
    res.json({ message: 'Backup completed', ...result });
  } catch (error) {
    logger.error({ err: error }, '[BACKUP] Error triggering backup');
    res.status(500).json({
      error: 'Backup failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
