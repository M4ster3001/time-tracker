import { logger } from '../../../shared/infrastructure/logger/logger.js';
import type {
  RetentionCleanupResult,
  RetentionRepository,
} from '../domain/repositories/retention.repository.js';

export const RETENTION_POLICY = {
  AUDIT_LOGS_DAYS: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10),
  EXPIRED_TOKENS_DAYS: parseInt(process.env.EXPIRED_TOKEN_RETENTION_DAYS || '30', 10),
  REVOKED_TOKENS_DAYS: parseInt(process.env.REVOKED_TOKEN_RETENTION_DAYS || '30', 10),
};

export const runDataRetentionCleanup = async (deps: {
  repository: RetentionRepository;
}): Promise<RetentionCleanupResult> => {
  logger.info('[DATA_RETENTION] Starting data retention cleanup...');
  const now = new Date();
  const auditLogCutoff = new Date(now);
  auditLogCutoff.setDate(auditLogCutoff.getDate() - RETENTION_POLICY.AUDIT_LOGS_DAYS);
  const tokenCutoff = new Date(now);
  tokenCutoff.setDate(tokenCutoff.getDate() - RETENTION_POLICY.EXPIRED_TOKENS_DAYS);
  const unusedTagCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const results = {
    auditLogs: await deps.repository.deleteAuditLogsOlderThan(auditLogCutoff),
    expiredTokens: await deps.repository.deleteExpiredRefreshTokensOlderThan(tokenCutoff),
    revokedTokens: await deps.repository.deleteRevokedRefreshTokensOlderThan(tokenCutoff),
    activityTags: await deps.repository.deleteUnusedActivityTagsOlderThan(unusedTagCutoff),
  };

  await deps.repository.logCleanup(results).catch((error) => {
    logger.error({ err: error }, '[DATA_RETENTION] Failed to log cleanup event');
  });
  return results;
};

export const getRetentionStats = async (deps: { repository: RetentionRepository }) => {
  const now = new Date();
  const auditLogCutoff = new Date(now);
  auditLogCutoff.setDate(auditLogCutoff.getDate() - RETENTION_POLICY.AUDIT_LOGS_DAYS);

  const [totalAuditLogs, oldAuditLogs, totalTokens, expiredTokens, revokedTokens] =
    await Promise.all([
      deps.repository.countAuditLogs(),
      deps.repository.countAuditLogsOlderThan(auditLogCutoff),
      deps.repository.countRefreshTokens(),
      deps.repository.countExpiredRefreshTokens(now),
      deps.repository.countRevokedRefreshTokens(),
    ]);

  return {
    auditLogs: { total: totalAuditLogs, olderThanPolicy: oldAuditLogs },
    refreshTokens: { total: totalTokens, expired: expiredTokens, revoked: revokedTokens },
  };
};
