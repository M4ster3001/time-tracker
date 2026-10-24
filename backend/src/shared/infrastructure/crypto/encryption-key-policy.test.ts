import { describe, expect, it } from 'vitest';
import {
  allowsDerivedFieldEncryptionKey,
  assertFieldEncryptionKeyConfigured,
} from './encryption-key-policy.js';

describe('encryption-key-policy', () => {
  it('allows deriving a field key only in development and test', () => {
    expect(allowsDerivedFieldEncryptionKey('development')).toBe(true);
    expect(allowsDerivedFieldEncryptionKey('test')).toBe(true);
    expect(allowsDerivedFieldEncryptionKey('staging')).toBe(false);
    expect(allowsDerivedFieldEncryptionKey('production')).toBe(false);
    expect(allowsDerivedFieldEncryptionKey('demo')).toBe(false);
  });

  it('fail-fasts when FIELD_ENCRYPTION_KEY is missing outside development/test', () => {
    expect(() =>
      assertFieldEncryptionKeyConfigured({
        env: 'staging',
        fieldEncryptionKey: undefined,
      })
    ).toThrow(/FIELD_ENCRYPTION_KEY is required/);

    expect(() =>
      assertFieldEncryptionKeyConfigured({
        env: 'production',
        fieldEncryptionKey: '',
      })
    ).toThrow(/FIELD_ENCRYPTION_KEY is required/);
  });

  it('allows missing key in development (caller may derive)', () => {
    expect(() =>
      assertFieldEncryptionKeyConfigured({
        env: 'development',
        fieldEncryptionKey: undefined,
      })
    ).not.toThrow();
  });
});
