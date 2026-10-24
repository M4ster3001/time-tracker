import { describe, expect, it } from 'vitest';
import {
  resolveLoginRateLimitMax,
  resolveRefreshRateLimitMax,
  usesRelaxedAuthRateLimits,
} from './auth-rate-limit-policy.js';

describe('auth-rate-limit-policy', () => {
  it('relaxes only for local development and test', () => {
    expect(usesRelaxedAuthRateLimits('development')).toBe(true);
    expect(usesRelaxedAuthRateLimits('test')).toBe(true);
    expect(usesRelaxedAuthRateLimits('staging')).toBe(false);
    expect(usesRelaxedAuthRateLimits('production')).toBe(false);
    expect(usesRelaxedAuthRateLimits('demo')).toBe(false);
  });

  it('keeps staging/production at configured login max', () => {
    expect(resolveLoginRateLimitMax('staging', 5)).toBe(5);
    expect(resolveLoginRateLimitMax('production', 5)).toBe(5);
    expect(resolveLoginRateLimitMax('development', 5)).toBe(100);
  });

  it('keeps staging/production refresh max tight', () => {
    expect(resolveRefreshRateLimitMax('staging')).toBe(20);
    expect(resolveRefreshRateLimitMax('production')).toBe(20);
    expect(resolveRefreshRateLimitMax('development')).toBe(200);
  });
});
