import {
  RETENTION_POLICY,
  getRetentionStats as getRetentionStatsUseCase,
  runDataRetentionCleanup as runDataRetentionCleanupUseCase,
  retentionRepository,
} from '../modules/health/index.js';

export { RETENTION_POLICY };

export const getRetentionStats = () =>
  getRetentionStatsUseCase({ repository: retentionRepository });
export const runDataRetentionCleanup = () =>
  runDataRetentionCleanupUseCase({ repository: retentionRepository });
