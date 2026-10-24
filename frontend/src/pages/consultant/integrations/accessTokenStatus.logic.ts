import type { AccessToken } from './types/accessTokens.types';

export type AccessTokenStatus = 'active' | 'expired' | 'revoked';

export const getAccessTokenStatus = (
  token: Pick<AccessToken, 'revokedAt' | 'expiresAt'>,
  now = new Date()
): AccessTokenStatus => {
  if (token.revokedAt) return 'revoked';
  if (new Date(token.expiresAt).getTime() < now.getTime()) return 'expired';
  return 'active';
};

export const ACCESS_TOKEN_STATUS_LABEL: Record<AccessTokenStatus, string> = {
  active: 'Ativo',
  expired: 'Expirado',
  revoked: 'Revogado',
};
