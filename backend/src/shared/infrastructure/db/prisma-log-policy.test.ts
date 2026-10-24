import { describe, expect, it } from 'vitest';
import { shouldLogPrismaQueries } from './prisma-log-policy.js';

describe('prisma-log-policy', () => {
  it('does not log queries by default even in development', () => {
    expect(shouldLogPrismaQueries({ NODE_ENV: 'development' })).toBe(false);
    expect(shouldLogPrismaQueries({ NODE_ENV: 'staging' })).toBe(false);
    expect(shouldLogPrismaQueries({ NODE_ENV: 'production' })).toBe(false);
  });

  it('logs queries only when development opt-in is explicit', () => {
    expect(
      shouldLogPrismaQueries({ NODE_ENV: 'development', PRISMA_LOG_QUERIES: 'true' })
    ).toBe(true);
    expect(
      shouldLogPrismaQueries({ NODE_ENV: 'staging', PRISMA_LOG_QUERIES: 'true' })
    ).toBe(false);
  });
});
