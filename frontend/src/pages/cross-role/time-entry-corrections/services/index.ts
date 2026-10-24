import api from '../../../../services/api';
import type { TimeEntryCorrectionsEntriesResponse } from '../types';
import type { TimeEntryCorrectionsClientOption, TimeEntryCorrectionsUserOption } from '../types';

export const fetchTimeEntryCorrectionsFilters = async (
  roleId?: number,
  signal?: AbortSignal
): Promise<{
  users: TimeEntryCorrectionsUserOption[];
  clients: TimeEntryCorrectionsClientOption[];
}> => {
  if (roleId === 1) {
    const [usersRes, clientsRes] = await Promise.all([
      api.get('/api/users', { signal }),
      api.get('/api/clients', { signal }),
    ]);
    const rawUsers = (usersRes.data.data || []) as Array<{
      id: number;
      name: string;
      roleId: number;
    }>;

    return {
      users: rawUsers.filter((item) => item.roleId === 2 || item.roleId === 3),
      clients: (clientsRes.data.data || []) as TimeEntryCorrectionsClientOption[],
    };
  }

  const [usersRes, clientsRes] = await Promise.all([
    api.get('/api/manager/consultants', { signal }),
    api.get('/api/manager/clients', { signal }),
  ]);

  return {
    users: (usersRes.data.data || []) as TimeEntryCorrectionsUserOption[],
    clients: (clientsRes.data.data || []) as TimeEntryCorrectionsClientOption[],
  };
};

export const fetchTimeEntryCorrectionsEntries = async (params: {
  userId?: number;
  clientId?: number;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
  signal?: AbortSignal;
}): Promise<TimeEntryCorrectionsEntriesResponse> => {
  const response = await api.get('/api/time-entries/supervised', {
    params: {
      userId: params.userId || undefined,
      clientId: params.clientId || undefined,
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined,
      page: params.page,
      limit: params.limit,
    },
    signal: params.signal,
  });
  return response.data.data || { items: [], total: 0 };
};

export const fetchTimeEntryCorrectionsEditClients = async (
  userId: number,
  year: number,
  month: number
): Promise<TimeEntryCorrectionsClientOption[]> => {
  const response = await api.get(`/api/users/${userId}/clients`, {
    params: {
      year,
      month,
    },
  });
  return (response.data.data || []) as TimeEntryCorrectionsClientOption[];
};

export const updateTimeEntryCorrection = async (
  id: number,
  payload: {
    clientId: number;
    date: string;
    activityDescription: string;
    durationMinutes: number;
  }
): Promise<void> => {
  await api.put(`/api/time-entries/${id}`, payload);
};

export const deleteTimeEntryCorrection = async (id: number): Promise<void> => {
  await api.delete(`/api/time-entries/${id}`);
};
