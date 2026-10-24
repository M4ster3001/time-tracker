import api from '../../../../services/api';
import type {
  ActivitySuggestion,
  ClientOption,
  DashboardResponse,
  LockStatus,
  QuickLogPayload,
} from '../types/dashboardPersonal.types';

export const fetchDashboardPersonal = async (params: {
  month: number;
  year: number;
  startDate?: string;
  endDate?: string;
}): Promise<DashboardResponse> => {
  const response = await api.get('/api/dashboards/consultant', { params });
  return response.data.data;
};

export const fetchDashboardClients = async (
  userId: number,
  includeHistorical = false
): Promise<ClientOption[]> => {
  const response = await api.get(`/api/users/${userId}/clients`, {
    params: { includeHistorical },
  });
  return response.data.data || [];
};

export const fetchActivityTags = async (clientId?: number): Promise<ActivitySuggestion[]> => {
  const response = await api.get('/api/activity-tags', {
    params: { limit: 8, ...(clientId ? { clientId } : {}) },
  });
  return response.data.data || [];
};

export const fetchAiStatus = async (): Promise<{ enabled: boolean; provider?: string | null }> => {
  const response = await api.get('/api/ai/status');
  return response.data;
};

export const fetchLockStatuses = async (
  ids: number[],
  month: number,
  year: number
): Promise<Record<number, LockStatus>> => {
  const results = await Promise.all(
    ids.map(async (id) => {
      const response = await api.get('/api/time-entries/lock-status', {
        params: { month, year, clientId: id },
      });
      return [id, response.data.data] as const;
    })
  );

  return results.reduce<Record<number, LockStatus>>((acc, [id, data]) => {
    acc[id] = data;
    return acc;
  }, {});
};

export const createQuickLogEntry = async (payload: QuickLogPayload) => {
  return api.post('/api/time-entries', {
    ...payload,
    date: new Date().toISOString().slice(0, 10),
  });
};
