/**
 * Prisma query logs include bound parameters (emails, filters, etc.).
 * Keep them opt-in even in development so LAN demos do not leak PII by default.
 */
export const shouldLogPrismaQueries = (env: {
  NODE_ENV?: string;
  PRISMA_LOG_QUERIES?: string;
}): boolean => env.NODE_ENV === 'development' && env.PRISMA_LOG_QUERIES === 'true';
