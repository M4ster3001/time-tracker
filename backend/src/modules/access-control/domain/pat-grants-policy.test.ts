import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONSULTANT_PAT_GRANTS,
  assertPatGrantsProvided,
  resolvePatTokenGrants,
} from './pat-grants-policy.js';

describe('pat-grants-policy', () => {
  it('resolvePatTokenGrants uses explicit grants when present', () => {
    const grants = [{ permission: 'time.read' as const, scope: 'self' as const }];
    expect(resolvePatTokenGrants(grants)).toEqual(grants);
  });

  it('resolvePatTokenGrants keeps narrow legacy defaults only when grants missing', () => {
    expect(resolvePatTokenGrants(undefined)).toEqual(DEFAULT_CONSULTANT_PAT_GRANTS);
    expect(resolvePatTokenGrants(null)).toEqual(DEFAULT_CONSULTANT_PAT_GRANTS);
  });

  it('resolvePatTokenGrants treats empty array as explicit deny (no legacy defaults)', () => {
    expect(resolvePatTokenGrants([])).toEqual([]);
  });

  it('assertPatGrantsProvided rejects missing or empty grants on create', () => {
    expect(() => assertPatGrantsProvided(undefined)).toThrow(/PAT_GRANTS_REQUIRED/);
    expect(() => assertPatGrantsProvided([])).toThrow(/PAT_GRANTS_REQUIRED/);
    expect(() =>
      assertPatGrantsProvided([{ permission: 'time.read', scope: 'self' }])
    ).not.toThrow();
  });

  it('DEFAULT_CONSULTANT_PAT_GRANTS stays self-scoped time+clients read/write', () => {
    expect(DEFAULT_CONSULTANT_PAT_GRANTS).toEqual([
      { permission: 'time.read', scope: 'self' },
      { permission: 'time.write', scope: 'self' },
      { permission: 'clients.read', scope: 'self' },
    ]);
  });
});
