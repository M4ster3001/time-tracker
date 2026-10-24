import api from '../../../../services/api';
import type {
  AccessToken,
  AccessTokenExpiryDays,
  CreatedAccessToken,
} from '../types/accessTokens.types';

export const fetchAccessTokens = async (): Promise<AccessToken[]> => {
  const response = await api.get('/api/access-tokens');
  return response.data.data || [];
};

/** Explicit self-scoped grants required by API (no silent server default on create). */
const DEFAULT_CREATE_GRANTS = [
  { permission: 'time.read', scope: 'self' },
  { permission: 'time.write', scope: 'self' },
  { permission: 'clients.read', scope: 'self' },
] as const;

export const createAccessToken = async (
  label: string,
  expiresInDays: AccessTokenExpiryDays
): Promise<CreatedAccessToken> => {
  const response = await api.post('/api/access-tokens', {
    label,
    expiresInDays,
    grants: [...DEFAULT_CREATE_GRANTS],
  });
  return response.data.data;
};
export const revokeAccessToken = async (id: number): Promise<void> => {
  await api.delete(`/api/access-tokens/${id}`);
};
