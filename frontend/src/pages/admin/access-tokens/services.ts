import api from '../../../services/api';
import type { AccessTokenWithOwner } from './types';

export const fetchAllAccessTokens = async (): Promise<AccessTokenWithOwner[]> => {
  const response = await api.get('/api/admin/access-tokens');
  return response.data.data || [];
};

export const adminRevokeAccessToken = async (id: number): Promise<void> => {
  await api.delete(`/api/admin/access-tokens/${id}`);
};
