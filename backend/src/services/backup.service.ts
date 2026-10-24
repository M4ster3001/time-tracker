import {
  backupAuditRepository,
  createBackupProviders,
  executeBackup as executeBackupUseCase,
  getBackupDependencyStatus,
  getBackupRuntimeStatus,
  getBackupStatus,
  initBackupScheduler as initBackupSchedulerUseCase,
  stopBackupScheduler,
  triggerManualBackup as triggerManualBackupUseCase,
} from '../modules/backup/index.js';

export type { BackupMetadata as IBackupMetadata } from '../modules/backup/application/backup.service.js';
export { getBackupDependencyStatus, getBackupRuntimeStatus, getBackupStatus, stopBackupScheduler };

export const executeBackup = () =>
  executeBackupUseCase({
    auditRepository: backupAuditRepository,
    providersFactory: createBackupProviders,
  });

export const triggerManualBackup = () =>
  triggerManualBackupUseCase({
    auditRepository: backupAuditRepository,
    providersFactory: createBackupProviders,
  });

export const initBackupScheduler = () =>
  initBackupSchedulerUseCase({
    providersFactory: createBackupProviders,
    triggerManualBackup,
  });
