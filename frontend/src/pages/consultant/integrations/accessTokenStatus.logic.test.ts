import { describe, expect, it } from 'vitest';
import { getAccessTokenStatus } from './accessTokenStatus.logic';

const baseToken = { revokedAt: null as string | null, expiresAt: '2026-12-31T00:00:00.000Z' };

describe('getAccessTokenStatus', () => {
  it('retorna revoked quando revokedAt esta preenchido, mesmo se ainda nao expirou', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(getAccessTokenStatus({ ...baseToken, revokedAt: '2026-01-01T00:00:00.000Z' }, now)).toBe(
      'revoked'
    );
  });

  it('retorna expired quando expiresAt ja passou e nao foi revogado', () => {
    const now = new Date('2027-01-01T00:00:00.000Z');
    expect(getAccessTokenStatus(baseToken, now)).toBe('expired');
  });

  it('retorna active quando nao revogado e ainda dentro da validade', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    expect(getAccessTokenStatus(baseToken, now)).toBe('active');
  });
});
