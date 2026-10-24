import { describe, expect, it } from 'vitest';
import {
  assertCorsPrivateLanFlagSafe,
  resolveAllowPrivateLan,
  usesPrivateLanCorsEnv,
} from './cors-private-lan-policy.js';

describe('cors-private-lan-policy', () => {
  it('permite LAN CORS so em development e test', () => {
    expect(usesPrivateLanCorsEnv('development')).toBe(true);
    expect(usesPrivateLanCorsEnv('test')).toBe(true);
    expect(usesPrivateLanCorsEnv('staging')).toBe(false);
    expect(usesPrivateLanCorsEnv('production')).toBe(false);
    expect(usesPrivateLanCorsEnv('demo')).toBe(false);
  });

  it('resolve false em staging/demo/production mesmo com flag true', () => {
    expect(resolveAllowPrivateLan({ env: 'staging', flagRequested: true })).toBe(false);
    expect(resolveAllowPrivateLan({ env: 'demo', flagRequested: true })).toBe(false);
    expect(resolveAllowPrivateLan({ env: 'production', flagRequested: true })).toBe(false);
    expect(resolveAllowPrivateLan({ env: 'development', flagRequested: true })).toBe(true);
    expect(resolveAllowPrivateLan({ env: 'development', flagRequested: false })).toBe(false);
  });

  it('falha alto se a flag estiver ligada fora de development/test', () => {
    expect(() =>
      assertCorsPrivateLanFlagSafe({ env: 'staging', flagRequested: true })
    ).toThrow(/CORS_ALLOW_PRIVATE_LAN/);
    expect(() =>
      assertCorsPrivateLanFlagSafe({ env: 'production', flagRequested: true })
    ).toThrow(/CORS_ALLOW_PRIVATE_LAN/);
    expect(() =>
      assertCorsPrivateLanFlagSafe({ env: 'demo', flagRequested: true })
    ).toThrow(/CORS_ALLOW_PRIVATE_LAN/);
    expect(() =>
      assertCorsPrivateLanFlagSafe({ env: 'development', flagRequested: true })
    ).not.toThrow();
    expect(() =>
      assertCorsPrivateLanFlagSafe({ env: 'staging', flagRequested: false })
    ).not.toThrow();
  });
});
