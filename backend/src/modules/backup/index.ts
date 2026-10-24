import { prisma } from '../../shared/infrastructure/db/prisma.js';
import { PrismaBackupAuditRepository } from './infrastructure/repositories/prisma-backup-audit.repository.js';

export const backupAuditRepository = new PrismaBackupAuditRepository(prisma);

export {
  AwsS3BackupProvider,
  AzureBlobBackupProvider,
  GcpStorageBackupProvider,
  LocalBackupProvider,
  createBackupProviders,
} from './infrastructure/providers/backup-provider.factory.js';
export {
  executeBackup,
  getBackupDependencyStatus,
  getBackupRuntimeStatus,
  getBackupStatus,
  initBackupScheduler,
  stopBackupScheduler,
  triggerManualBackup,
} from './application/backup.service.js';
export { getBackupStatusController, triggerBackupController } from './http/controller.js';
