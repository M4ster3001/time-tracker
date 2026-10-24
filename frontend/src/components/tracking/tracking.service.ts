import api from '../../services/api';

export type TrackingSession = {
  id: number;
  userId: number;
  timeEntryId: number | null;
  state: 'RUNNING' | 'PAUSED' | 'STOPPED';
  startedAt: string;
  endedAt: string | null;
  pausedAt: string | null;
  accumulatedPausedMs: number;
  source: 'TIMER' | 'IMPORT';
  externalId: string | null;
};

export const fetchActiveTrackingSession = async (): Promise<TrackingSession | null> => {
  const response = await api.get('/api/tracking-sessions/active');
  return (response.data.data?.session ?? null) as TrackingSession | null;
};

export const startTrackingSession = async (timeEntryId?: number | null) => {
  const response = await api.post('/api/tracking-sessions', {
    timeEntryId: timeEntryId ?? null,
  });
  return response.data.data as TrackingSession;
};

export const pauseTrackingSession = async (id: number) => {
  const response = await api.post(`/api/tracking-sessions/${id}/pause`);
  return response.data.data as TrackingSession;
};

export const resumeTrackingSession = async (id: number) => {
  const response = await api.post(`/api/tracking-sessions/${id}/resume`);
  return response.data.data as TrackingSession;
};

export const stopTrackingSession = async (id: number) => {
  const response = await api.post(`/api/tracking-sessions/${id}/stop`);
  return response.data.data as TrackingSession;
};

export type ImportTrackingSessionBody = {
  externalId: string;
  startedAt: string;
  endedAt: string;
  timeEntryId?: number | null;
  accumulatedPausedMs?: number;
};

export type ImportTrackingSessionResult = TrackingSession & {
  created: boolean;
};

/** POST /api/tracking-sessions/import — STOPPED + source IMPORT; dedupe externalId. */
export const importTrackingSession = async (
  body: ImportTrackingSessionBody,
  signal?: AbortSignal
): Promise<ImportTrackingSessionResult> => {
  const response = await api.post('/api/tracking-sessions/import', body, { signal });
  return response.data.data as ImportTrackingSessionResult;
};
