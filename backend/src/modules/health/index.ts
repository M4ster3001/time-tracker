import { prisma } from '../../shared/infrastructure/db/prisma.js';
import { PrismaHealthRepository } from './infrastructure/repositories/prisma-health.repository.js';
import { PrismaRetentionRepository } from './infrastructure/repositories/prisma-retention.repository.js';
import { PrismaAdminBulkRepository } from './infrastructure/repositories/prisma-admin-bulk.repository.js';
import { PrismaDailySeedRepository } from './infrastructure/repositories/prisma-daily-seed.repository.js';

export const healthRepository = new PrismaHealthRepository(prisma);
export const retentionRepository = new PrismaRetentionRepository(prisma);
export const adminBulkRepository = new PrismaAdminBulkRepository(prisma);
export const dailySeedRepository = new PrismaDailySeedRepository(prisma);

export { getHealthStatus, getReadinessStatus } from './application/health.service.js';
export {
  RETENTION_POLICY,
  getRetentionStats,
  runDataRetentionCleanup,
} from './application/data-retention.service.js';
export {
  bulkActivateUsers,
  bulkDeactivateUsers,
  bulkImportUsers,
  parseCsvContent,
} from './application/admin-bulk.service.js';
export {
  __testOnly as dailySeedTestUtils,
  getDailySeedRuntimeStatus,
  runDailySeedIfNeeded,
} from './application/daily-seed.service.js';
export {
  healthCheckController,
  healthLiveController,
  healthReadyController,
  jobsStatusController,
} from './http/health.controller.js';
export {
  retentionCleanupController,
  retentionHistoryController,
  retentionStatusController,
} from './http/data-retention.controller.js';
export {
  bulkActivateController,
  bulkDeactivateController,
  bulkImportController,
  csvTemplateController,
} from './http/admin-bulk.controller.js';
