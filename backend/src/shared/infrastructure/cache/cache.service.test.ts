import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../config.js', () => ({
  config: {
    redis: {
      enabled: true,
      url: 'redis://localhost:6379',
    },
  },
}));

vi.mock('../logger/logger.js', () => ({
  logger: {
    info: loggerMocks.info,
    warn: loggerMocks.warn,
    error: loggerMocks.error,
  },
}));

import { cacheGet, cacheSet, getCacheStats } from './cache.service.js';

describe('cache service fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses in-memory cache without warning when redis is unavailable', async () => {
    await cacheSet('cache:test', { ok: true }, 60);
    const value = await cacheGet<{ ok: boolean }>('cache:test');
    const stats = await getCacheStats();

    expect(value).toEqual({ ok: true });
    expect(stats.type).toBe('memory');
    expect(stats.connected).toBe(true);
    expect(loggerMocks.info).not.toHaveBeenCalled();
    expect(loggerMocks.warn).not.toHaveBeenCalled();
  });
});
