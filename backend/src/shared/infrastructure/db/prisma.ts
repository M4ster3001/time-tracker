import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger.js';
import { isDesktopRuntime } from '../runtime/app-runtime.js';
import { shouldLogPrismaQueries } from './prisma-log-policy.js';

export const prisma = new PrismaClient({
  log: shouldLogPrismaQueries(process.env) ? ['query', 'error', 'warn'] : ['error'],
  // After waiting for a row lock, invariant checks must see the last commit.
  // MySQL's default repeatable-read snapshot could otherwise predate that lock.
  transactionOptions: {
    isolationLevel: isDesktopRuntime() ? Prisma.TransactionIsolationLevel.Serializable : Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 10000,
    timeout: 15000,
  },
});

// Operational queries exclude tombstones. Sync explicitly requests all states
// with a deletedAt filter so deletions can propagate to offline installations.
prisma.$use(async (params, next) => {
  if (params.model === 'TimeEntry' &&
      ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
        'count', 'aggregate', 'groupBy'].includes(params.action)) {
    params.args ??= {};
    params.args.where ??= {};
    if (!Object.prototype.hasOwnProperty.call(params.args.where, 'deletedAt')) {
      params.args.where.deletedAt = null;
    }
  }
  return next(params);
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to database');
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
};
