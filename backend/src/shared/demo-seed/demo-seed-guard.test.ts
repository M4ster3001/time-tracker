import { describe, expect, it } from 'vitest';
import {
  DEMO_SEED_CONFIRM_VALUE,
  assertDemoSeedAllowed,
  isLocalDatabaseUrl,
  looksLikeProductionDatabaseUrl,
} from './demo-seed-guard.js';

const allowedEnv = {
  NODE_ENV: 'development',
  ALLOW_DEMO_SEED: 'true',
  CONFIRM_DEMO_SEED_DELETE: DEMO_SEED_CONFIRM_VALUE,
  DATABASE_URL: 'mysql://root:pass@localhost:3306/time_tracker',
};

describe('demo-seed-guard', () => {
  it('allows local development with double opt-in', () => {
    expect(() => assertDemoSeedAllowed(allowedEnv)).not.toThrow();
  });

  it('requires CONFIRM_DEMO_SEED_DELETE even when ALLOW_DEMO_SEED is true', () => {
    expect(() =>
      assertDemoSeedAllowed({ ...allowedEnv, CONFIRM_DEMO_SEED_DELETE: undefined })
    ).toThrow(/CONFIRM_DEMO_SEED_DELETE/);
  });

  it('blocks production-looking DATABASE_URL', () => {
    expect(() =>
      assertDemoSeedAllowed({
        ...allowedEnv,
        DATABASE_URL: 'mysql://u:test-user-1@example.test:3306/tt',
      })
    ).toThrow(/DATABASE_URL/);
  });

  it('blocks when NODE_ENV is not development', () => {
    expect(() => assertDemoSeedAllowed({ ...allowedEnv, NODE_ENV: 'production' })).toThrow(
      /NODE_ENV/
    );
  });

  it('classifies localhost as local and remote host as prod-like', () => {
    expect(isLocalDatabaseUrl('mysql://root@127.0.0.1:3306/tt')).toBe(true);
    expect(looksLikeProductionDatabaseUrl('mysql://u:test-user-2@example.test/tt')).toBe(true);
  });
});
