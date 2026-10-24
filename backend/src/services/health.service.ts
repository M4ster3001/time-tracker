import { prisma } from '../shared/infrastructure/db/prisma.js';
import {
  getHealthStatus as getHealthStatusUseCase,
  getReadinessStatus,
} from '../modules/health/application/health.service.js';
import { healthRepository } from '../modules/health/index.js';

export type {
  Alert,
  CheckResult,
  HealthStatus,
  RecentError,
} from '../modules/health/application/health.service.js';

export const getHealthStatus = () => getHealthStatusUseCase({ repository: healthRepository });
export const getHealthReadiness = () => getReadinessStatus({ prisma });
