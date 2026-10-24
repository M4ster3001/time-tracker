import api from '../../../../services/api';
import type {
  ClientOption,
  TemporaryUnlock,
  UnlockDetails,
  UserOption,
} from '../types/adminTemporaryUnlocks.types';

export async function fetchAdminTemporaryUnlocks(activeOnly: boolean): Promise<TemporaryUnlock[]> {
  const response = await api.get('/api/admin/temporary-unlocks', {
    params: { activeOnly: activeOnly ? 'true' : 'false' },
  });
  return response.data.data || [];
}

export async function fetchAdminTemporaryUnlockOptions(): Promise<{
  users: UserOption[];
  clients: ClientOption[];
}> {
  const [usersRes, clientsRes] = await Promise.all([
    api.get('/api/users', { params: { limit: 100 } }),
    api.get('/api/clients', { params: { limit: 100 } }),
  ]);
  return {
    users: usersRes.data.data || [],
    clients: clientsRes.data.data || [],
  };
}

export async function grantAdminTemporaryUnlock(payload: {
  userId: number;
  clientId: number;
  periodYear: number;
  periodMonth: number;
  reason: string;
  durationHours: number;
}): Promise<void> {
  await api.post('/api/admin/temporary-unlocks', payload);
}

export async function revokeAdminTemporaryUnlock(id: number): Promise<void> {
  await api.post(`/api/admin/temporary-unlocks/${id}/revoke`);
}

export async function fetchAdminTemporaryUnlockDetails(id: number): Promise<UnlockDetails> {
  const response = await api.get(`/api/admin/temporary-unlocks/${id}`);
  return response.data.data;
}
