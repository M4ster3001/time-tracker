import api from '../../../../services/api';
import type {
  ClientOption,
  ProjectOption,
  TimeEntryAiStatus,
  TimeEntryDurationContract,
  TimeEntryLockStatus,
  TimeEntryPayload,
} from '../types/timeEntry.types';

export const fetchTimeEntryClients = async (userId: number, includeHistorical: boolean) => {
  const response = await api.get(`/api/users/${userId}/clients`, {
    params: { includeHistorical },
  });
  return (response.data.data || []) as ClientOption[];
};

export const fetchClientProjects = async (clientId: number) => {
  const response = await api.get('/api/projects', { params: { clientId } });
  return (response.data.data || []) as ProjectOption[];
};

export const fetchTimeEntryAiStatus = async () => {
  const response = await api.get('/api/ai/status');
  return response.data as TimeEntryAiStatus;
};

export const fetchTimeEntry = async (id: string) => {
  const response = await api.get(`/api/time-entries/${id}`);
  return response.data.data as {
    id?: number;
    userId: number;
    clientId: number;
    projectId?: number | null;
    workActivityId?: number | null;
    date: string;
    activityDescription: string;
    durationMinutes: number;
    confirmedAt?: string | null;
    confirmedByUserId?: number | null;
    confirmedDurationMinutes?: number | null;
    durations?: TimeEntryDurationContract;
  };
};

export const fetchTimeEntryLockStatus = async (month: number, year: number, clientId?: number) => {
  const response = await api.get('/api/time-entries/lock-status', {
    params: { month, year, clientId: clientId || undefined },
  });
  return response.data.data as TimeEntryLockStatus;
};

export const createTimeEntry = async (payload: TimeEntryPayload) => {
  await api.post('/api/time-entries', payload);
};

export const updateTimeEntry = async (id: string, payload: TimeEntryPayload) => {
  await api.put(`/api/time-entries/${id}`, payload);
};

export const confirmTimeEntryDuration = async (
  id: string,
  payload: { confirmedMinutes: number; justification?: string }
) => {
  const response = await api.post(`/api/time-entries/${id}/confirm-duration`, payload);
  return response.data.data as {
    durationMinutes: number;
    durations?: TimeEntryDurationContract;
  };
};
