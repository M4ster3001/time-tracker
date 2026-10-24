/**
 * Cache Service with Redis support
 * PERF-02: Optional Redis caching with automatic invalidation
 * Falls back to in-memory cache when Redis is not configured
 */

import { createRequire } from 'node:module';
import { config } from '../../../config.js';
import { logger } from '../logger/logger.js';

// Cache key prefixes for different data types
export const CACHE_KEYS = {
  DASHBOARD_CONSULTANT: 'dashboard:consultant:',
  DASHBOARD_MANAGER: 'dashboard:manager:',
  DASHBOARD_ADMIN: 'dashboard:admin',
  LOCK_STATUS: 'lock:status:',
  LOCK_STATUS_BATCH: 'lock:status:batch:',
} as const;

// In-memory cache as fallback when Redis is disabled
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

// Redis client (initialized lazily)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any = null;
let redisInitialized = false;
const require = createRequire(import.meta.url);

/**
 * Initialize Redis connection if enabled
 */
const initRedis = async (): Promise<boolean> => {
  if (redisInitialized) return redisClient !== null;
  redisInitialized = true;

  if (!config.redis.enabled) {
    logger.info('[CACHE] Redis disabled, using in-memory cache');
    return false;
  }

  try {
    // Lazy require avoids hard dependency when Redis is disabled and keeps tests quiet in Vitest.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
    const redis = require('redis') as any;
    redisClient = redis.createClient({ url: config.redis.url });

    redisClient.on('error', (err: Error) => {
      logger.error({ err }, '[CACHE] Redis error');
    });

    redisClient.on('connect', () => {
      logger.info('[CACHE] Redis connected');
    });

    await redisClient.connect();
    return true;
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error('Unknown error');
    const isMissingRedisModule =
      normalizedError instanceof Error &&
      // Vitest / CI can run without the optional redis dependency installed.
      (normalizedError as Error & { code?: string }).code === 'MODULE_NOT_FOUND';

    if (!isMissingRedisModule) {
      logger.warn({ err: normalizedError }, '[CACHE] Redis not available, using in-memory cache');
    }
    redisClient = null;
    return false;
  }
};

/**
 * Get value from cache
 */
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    await initRedis();

    if (redisClient) {
      const value = await redisClient.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    }

    // Fallback to memory cache
    const cached = memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    if (cached) {
      memoryCache.delete(key);
    }
    return null;
  } catch (error) {
    logger.error({ err: error }, '[CACHE] Get error');
    return null;
  }
};

/**
 * Set value in cache with TTL (in seconds)
 */
export const cacheSet = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  try {
    await initRedis();

    if (redisClient) {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      return;
    }

    // Fallback to memory cache
    memoryCache.set(key, {
      data: value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  } catch (error) {
    logger.error({ err: error }, '[CACHE] Set error');
  }
};

/**
 * Delete a specific key from cache
 */
export const cacheDelete = async (key: string): Promise<void> => {
  try {
    await initRedis();

    if (redisClient) {
      await redisClient.del(key);
      return;
    }

    memoryCache.delete(key);
  } catch (error) {
    logger.error({ err: error }, '[CACHE] Delete error');
  }
};

/**
 * Delete all keys matching a pattern
 */
export const cacheDeletePattern = async (pattern: string): Promise<void> => {
  try {
    await initRedis();

    if (redisClient) {
      // Use SCAN to find and delete keys matching pattern
      let cursor = 0;
      do {
        const result = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = result.cursor;
        if (result.keys.length > 0) {
          await redisClient.del(result.keys);
        }
      } while (cursor !== 0);
      return;
    }

    // Fallback to memory cache - delete matching keys
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
      }
    }
  } catch (error) {
    logger.error({ err: error }, '[CACHE] Delete pattern error');
  }
};

/**
 * Invalidate dashboard caches for a user
 */
export const invalidateDashboardCache = async (userId?: number): Promise<void> => {
  if (userId) {
    await cacheDeletePattern(`${CACHE_KEYS.DASHBOARD_CONSULTANT}${userId}:*`);
    await cacheDeletePattern(`${CACHE_KEYS.DASHBOARD_MANAGER}${userId}:*`);
    await cacheDeletePattern(`${CACHE_KEYS.DASHBOARD_MANAGER}*`);
  }
  // Always invalidate admin dashboard as it shows aggregated data
  await cacheDeletePattern(`${CACHE_KEYS.DASHBOARD_ADMIN}*`);
};

/**
 * Invalidate lock status cache
 */
export const invalidateLockStatusCache = async (
  userId?: number,
  clientId?: number
): Promise<void> => {
  if (userId && clientId) {
    await cacheDelete(`${CACHE_KEYS.LOCK_STATUS}${userId}:${clientId}`);
  }
  if (userId) {
    await cacheDeletePattern(`${CACHE_KEYS.LOCK_STATUS_BATCH}${userId}:*`);
  }
};

/**
 * Invalidate all caches related to time entries
 * Called after create/update/delete time entry
 */
export const invalidateTimeEntryRelatedCaches = async (
  userId: number,
  clientIds?: number[]
): Promise<void> => {
  await invalidateDashboardCache(userId);
  if (clientIds && clientIds.length > 0) {
    const uniqueIds = Array.from(new Set(clientIds.filter((id) => Number.isFinite(id))));
    await Promise.all(uniqueIds.map((clientId) => invalidateLockStatusCache(userId, clientId)));
    return;
  }
  await invalidateLockStatusCache(userId);
};

/**
 * Check if caching is enabled
 */
export const isCacheEnabled = (): boolean => {
  return config.redis.enabled || true; // Memory cache always available
};

/**
 * Get cache stats (for debugging/monitoring)
 */
export const getCacheStats = async (): Promise<{
  type: 'redis' | 'memory';
  connected: boolean;
  memorySize?: number;
}> => {
  await initRedis();

  if (redisClient) {
    try {
      await redisClient.ping();
      return { type: 'redis', connected: true };
    } catch {
      return { type: 'redis', connected: false };
    }
  }

  return {
    type: 'memory',
    connected: true,
    memorySize: memoryCache.size,
  };
};

/**
 * Close Redis connection (for graceful shutdown)
 */
export const closeCacheConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  memoryCache.clear();
};
