import { Request, Response } from 'express';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { retentionRepository } from '../index.js';
import {
  RETENTION_POLICY,
  getRetentionStats,
  runDataRetentionCleanup,
} from '../application/data-retention.service.js';

export const retentionStatusController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getRetentionStats({ repository: retentionRepository });
    const lastCleanup = await retentionRepository.findLastCleanup();
    const now = new Date();
    const auditLogCutoff = new Date(now);
    auditLogCutoff.setDate(auditLogCutoff.getDate() - RETENTION_POLICY.AUDIT_LOGS_DAYS);
    const tokenCutoff = new Date(now);
    tokenCutoff.setDate(tokenCutoff.getDate() - RETENTION_POLICY.EXPIRED_TOKENS_DAYS);
    const unusedTagCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const [pendingAuditLogs, pendingExpiredTokens, pendingRevokedTokens, pendingActivityTags] =
      await Promise.all([
        retentionRepository.countAuditLogsOlderThan(auditLogCutoff),
        retentionRepository.countExpiredRefreshTokens(tokenCutoff),
        retentionRepository.countRevokedRefreshTokensOlderThan(tokenCutoff),
        retentionRepository.countUnusedActivityTagsOlderThan(unusedTagCutoff),
      ]);

    res.json({
      success: true,
      data: {
        policy: {
          auditLogsDays: RETENTION_POLICY.AUDIT_LOGS_DAYS,
          expiredTokensDays: RETENTION_POLICY.EXPIRED_TOKENS_DAYS,
          revokedTokensDays: RETENTION_POLICY.REVOKED_TOKENS_DAYS,
          unusedActivityTagsDays: 365,
        },
        statistics: stats,
        pendingCleanup: {
          auditLogs: pendingAuditLogs,
          expiredTokens: pendingExpiredTokens,
          revokedTokens: pendingRevokedTokens,
          activityTags: pendingActivityTags,
          total:
            pendingAuditLogs + pendingExpiredTokens + pendingRevokedTokens + pendingActivityTags,
        },
        lastCleanup: lastCleanup
          ? {
              timestamp: lastCleanup.createdAt.toISOString(),
              results: lastCleanup.details ? JSON.parse(lastCleanup.details) : null,
            }
          : null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting retention status');
    res.status(500).json({ success: false, message: 'Erro ao obter status de retencao' });
  }
};

export const retentionCleanupController = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUserId = req.user!.userId;
    await retentionRepository.logManualTrigger(adminUserId);
    const results = await runDataRetentionCleanup({ repository: retentionRepository });
    res.json({
      success: true,
      data: {
        results,
        totalDeleted:
          results.auditLogs + results.expiredTokens + results.revokedTokens + results.activityTags,
        message: 'Limpeza de retencao concluida com sucesso',
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Error running retention cleanup');
    res.status(500).json({ success: false, message: 'Erro ao executar limpeza de retencao' });
  }
};

export const retentionHistoryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const history = await retentionRepository.findCleanupHistory(limit);
    res.json({
      success: true,
      data: history.map((entry) => ({
        id: entry.id,
        action: entry.action,
        status: entry.status,
        results: entry.details ? JSON.parse(entry.details) : null,
        timestamp: entry.createdAt.toISOString(),
        triggeredBy: entry.user?.name || 'Sistema',
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting retention history');
    res.status(500).json({ success: false, message: 'Erro ao obter historico de retencao' });
  }
};
