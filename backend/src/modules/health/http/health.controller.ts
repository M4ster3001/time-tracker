import type { Request, Response } from 'express';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { config } from '../../../config.js';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { getBackupRuntimeStatus } from '../../backup/index.js';
import { healthRepository } from '../index.js';
import { getDailySeedRuntimeStatus } from '../application/daily-seed.service.js';
import { getHealthStatus, getReadinessStatus } from '../application/health.service.js';

export const healthCheckController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const health = await getHealthStatus({ repository: healthRepository });
    res.status(200).json({
      success: true,
      data: {
        ...health,
        httpStatus: health.status === 'unhealthy' ? 503 : 200,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Health check error');
    res.status(200).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        message: 'Erro ao verificar status do sistema',
        httpStatus: 500,
      },
    });
  }
};

export const healthLiveController = (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
};

export const healthReadyController = async (_req: Request, res: Response): Promise<void> => {
  const readiness = await getReadinessStatus({ prisma });
  res.status(readiness.ready ? 200 : 503).json({
    status: readiness.ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks: readiness.checks,
    cacheType: readiness.cacheType,
  });
};

export const jobsStatusController = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    data: {
      backup: {
        enabled: config.backup.enabled,
        schedule: config.backup.schedule,
        timezone: process.env.TZ || 'UTC',
        ...getBackupRuntimeStatus(),
      },
      dailySeed: getDailySeedRuntimeStatus(),
    },
  });
};
