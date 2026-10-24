import { PrismaClient } from '@prisma/client';
import { config } from '../../../config.js';
import { getCacheStats } from '../../../shared/infrastructure/cache/cache.service.js';
import type { HealthRepository } from '../domain/repositories/health.repository.js';

const fallbackDiskCheck = (): CheckResult => ({
  status: 'ok',
  message: 'Verificacao de disco nao implementada',
});

export interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  message: string;
  value?: number | string;
}

export interface RecentError {
  timestamp: string;
  endpoint: string;
  action: string;
  details: string | null;
}

export interface Alert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  summary: string;
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: CheckResult;
    memory: CheckResult;
    disk: CheckResult;
  };
  metrics: {
    totalUsers: number;
    activeUsers: number;
    totalClients: number;
    activeClients: number;
    totalTimeEntries: number;
    timeEntriesLast24h: number;
    recentErrors: RecentError[];
    errorRateLast24h: number;
  };
  alerts: Alert[];
  recommendations: string[];
}

const startTime = Date.now();

const checkMemory = (): CheckResult => {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const usagePercent = (used.heapUsed / used.heapTotal) * 100;

  if (usagePercent > 85) {
    return {
      status: 'error',
      message: `Uso critico: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(0)}%)`,
      value: usagePercent,
    };
  }
  if (usagePercent > 60) {
    return {
      status: 'warning',
      message: `Uso alto: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(0)}%)`,
      value: usagePercent,
    };
  }
  return {
    status: 'ok',
    message: `${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(0)}%)`,
    value: usagePercent,
  };
};

const checkDatabase = async (repository: HealthRepository): Promise<CheckResult> => {
  try {
    const responseTime = await repository.ping();
    if (responseTime > 1000) {
      return {
        status: 'warning',
        message: `Tempo de resposta alto: ${responseTime}ms`,
        value: responseTime,
      };
    }
    return { status: 'ok', message: `Conectado (${responseTime}ms)`, value: responseTime };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Erro de conexao' };
  }
};

export const getHealthStatus = async (deps: {
  repository: HealthRepository;
}): Promise<HealthStatus> => {
  const alerts: Alert[] = [];
  const recommendations: string[] = [];
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const dbCheck = await checkDatabase(deps.repository);
  const memCheck = checkMemory();
  const diskCheck = fallbackDiskCheck();

  if (dbCheck.status !== 'ok') {
    alerts.push({
      severity: 'critical',
      message: 'Problemas de conexao com banco de dados',
      timestamp: now.toISOString(),
    });
    recommendations.push('Verifique a conexao com o banco e o status do container MySQL.');
  }
  if (memCheck.status === 'error' || memCheck.status === 'warning') {
    alerts.push({
      severity: 'warning',
      message: memCheck.status === 'error' ? 'Uso de memoria critico' : 'Uso de memoria alto',
      timestamp: now.toISOString(),
    });
  }

  const [
    totalUsers,
    activeUsers,
    totalClients,
    activeClients,
    totalTimeEntries,
    timeEntriesLast24h,
    recentErrors,
    errorCount,
    totalLogsLast24h,
    lockedAccounts,
  ] = await Promise.all([
    deps.repository.countUsers(),
    deps.repository.countUsers({ activeOnly: true }),
    deps.repository.countClients(),
    deps.repository.countClients({ activeOnly: true }),
    deps.repository.countTimeEntries(),
    deps.repository.countTimeEntriesCreatedSince(yesterday),
    deps.repository.findRecentFailedAuditLogs(yesterday, 10),
    deps.repository.countFailedAuditLogsCreatedSince(yesterday),
    deps.repository.countAuditLogsCreatedSince(yesterday),
    deps.repository.countUsers({ lockedOnly: true }),
  ]);

  const errorRateLast24h = totalLogsLast24h > 0 ? (errorCount / totalLogsLast24h) * 100 : 0;
  if (errorRateLast24h > 10) {
    alerts.push({
      severity: 'critical',
      message: `Taxa de erro alta: ${errorRateLast24h.toFixed(1)}% nas ultimas 24h`,
      timestamp: now.toISOString(),
    });
  } else if (errorRateLast24h > 5) {
    alerts.push({
      severity: 'warning',
      message: `Taxa de erro elevada: ${errorRateLast24h.toFixed(1)}% nas ultimas 24h`,
      timestamp: now.toISOString(),
    });
  }
  if (lockedAccounts > 0) {
    alerts.push({
      severity: 'info',
      message: `${lockedAccounts} conta(s) bloqueada(s) por tentativas de login`,
      timestamp: now.toISOString(),
    });
  }

  const inactiveUserPercent = totalUsers > 0 ? ((totalUsers - activeUsers) / totalUsers) * 100 : 0;
  if (inactiveUserPercent > 30) {
    alerts.push({
      severity: 'info',
      message: `${inactiveUserPercent.toFixed(0)}% dos usuarios estao inativos`,
      timestamp: now.toISOString(),
    });
  }

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (dbCheck.status === 'error' || diskCheck.status === 'error') {
    status = 'unhealthy';
  } else if (alerts.some((alert) => alert.severity === 'warning')) {
    status = 'degraded';
  }

  return {
    status,
    summary:
      status === 'healthy'
        ? 'Tudo operacional.'
        : status === 'degraded'
          ? 'Sistema operacional com alertas.'
          : 'Sistema com falhas criticas.',
    timestamp: now.toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || '1.0.0',
    checks: { database: dbCheck, memory: memCheck, disk: diskCheck },
    metrics: {
      totalUsers,
      activeUsers,
      totalClients,
      activeClients,
      totalTimeEntries,
      timeEntriesLast24h,
      recentErrors,
      errorRateLast24h: Math.round(errorRateLast24h * 100) / 100,
    },
    alerts,
    recommendations,
  };
};

export const getReadinessStatus = async (deps: {
  prisma: Pick<PrismaClient, '$queryRaw'>;
}): Promise<{
  ready: boolean;
  cacheType: 'redis' | 'memory' | 'unavailable';
  checks: { database: 'ok' | 'error'; cache: 'ok' | 'error' | 'disabled' };
}> => {
  let databaseReady = false;
  let cacheReady = true;
  let cacheType: 'redis' | 'memory' | 'unavailable' = 'memory';

  try {
    await deps.prisma.$queryRaw`SELECT 1`;
    databaseReady = true;
  } catch {
    databaseReady = false;
  }

  try {
    const cacheStats = await getCacheStats();
    cacheReady = cacheStats.connected;
    cacheType = cacheStats.type;
  } catch {
    cacheReady = false;
    cacheType = 'unavailable';
  }

  return {
    ready: databaseReady && (!config.redis.enabled || cacheReady),
    cacheType,
    checks: {
      database: databaseReady ? 'ok' : 'error',
      cache: !config.redis.enabled ? 'disabled' : cacheReady ? 'ok' : 'error',
    },
  };
};
