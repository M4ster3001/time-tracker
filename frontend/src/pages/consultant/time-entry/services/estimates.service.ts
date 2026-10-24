import api from '../../../../services/api';

export type TaskTypeRow = {
  id: number;
  code: string;
  namePt: string;
  nameEn: string;
};

export type EstimateRevisionRow = {
  id: number;
  uuid: string;
  version: number;
  baseMinutes: number;
  factor: number | string;
  rawMinutes: number | string;
  suggestedMinutes: number;
  roundingMode: string;
  parameterRevisionUuid: string | null;
  origin: string;
  algorithmVersion: string;
  reason: string | null;
  createdAt?: string;
};

export type WorkActivityRow = {
  id: number;
  uuid: string;
  title: string;
  clientId: number;
  projectId: number | null;
};

export const fetchTaskTypes = async () => {
  const response = await api.get('/api/task-types');
  return (response.data.data || []) as TaskTypeRow[];
};

export const createWorkActivity = async (payload: {
  clientId: number;
  title: string;
  projectId?: number | null;
  description?: string | null;
  taskTypeCode?: string | null;
  timeEntryId?: number | null;
}) => {
  const response = await api.post('/api/work-activities', payload);
  return response.data.data as WorkActivityRow;
};

export const createEstimateRevision = async (
  workActivityId: number,
  payload: {
    baseMinutes?: number;
    factor?: number;
    origin?: 'CATALOG' | 'ONE_OFF' | 'MCP' | 'AI';
    reason?: string;
  }
) => {
  const response = await api.post(
    `/api/work-activities/${workActivityId}/estimate-revisions`,
    payload
  );
  return response.data.data as {
    activity: WorkActivityRow;
    revision: EstimateRevisionRow;
    mutatesCatalog: boolean;
  };
};

export const previewEstimate = async (payload: {
  baseMinutes?: number;
  factor?: number;
  taskTypeCode?: string;
}) => {
  const response = await api.post('/api/estimates/preview', payload);
  return response.data.data as {
    baseMinutes: number;
    factor: number;
    rawMinutes: number;
    suggestedMinutes: number;
    roundingMode: string;
    parameterRevisionUuid: string | null;
  };
};

export type DurationConfirmationHistoryItem = {
  id: number;
  uuid: string;
  version: number;
  confirmedMinutes: number;
  estimatedMinutesSnapshot: number | null;
  justification: string | null;
  confirmedByUserId: number;
  confirmedAt: string;
  previousConfirmationId: number | null;
  estimateRevisionId: number | null;
  workActivityId: number | null;
};

export type EstimateRevisionHistoryItem = EstimateRevisionRow & {
  formula: string;
  authorUserId?: number | null;
  previousRevisionId?: number | null;
  createdAt?: string;
};

export type EstimationReferenceHistoryItem = {
  id: number;
  uuid: string;
  provider: string;
  kind: string;
  externalId: string;
  repository: string | null;
  title: string | null;
  uri: string | null;
  collectedAt: string;
  isActualTrackedEvidence: false;
  disclaimer: string;
};

export type TimeEntryEstimateHistory = {
  timeEntryId: number;
  workActivityId: number | null;
  actualTrackedMinutes: number | null;
  durationConfirmations: DurationConfirmationHistoryItem[];
  estimateRevisions: EstimateRevisionHistoryItem[];
  estimationReferences: EstimationReferenceHistoryItem[];
};

export const fetchTimeEntryEstimateHistory = async (timeEntryId: number) => {
  const response = await api.get(`/api/time-entries/${timeEntryId}/estimate-history`);
  return response.data.data as TimeEntryEstimateHistory;
};

export const linkEstimationReference = async (payload: {
  kind: 'COMMIT' | 'PULL_REQUEST' | 'ISSUE' | 'DOCUMENT' | 'MANUAL';
  provider: string;
  externalId: string;
  repository?: string | null;
  title?: string | null;
  uri?: string | null;
  timeEntryId: number;
  projectId?: number | null;
}) => {
  const response = await api.post('/api/estimates/references', {
    ...payload,
    presentAsActualTracked: false,
  });
  return response.data.data as EstimationReferenceHistoryItem & { note?: string };
};

/** SRC-01 — metadados de commit local (provider local-git); nunca Actual Tracked. */
export const linkLocalGitCommitReference = async (payload: {
  sha: string;
  message: string;
  repository: string;
  authorEmail?: string | null;
  authorName?: string | null;
  timeEntryId: number;
  projectId?: number | null;
}) => {
  const response = await api.post('/api/estimates/references/local-git', {
    sha: payload.sha,
    message: payload.message,
    repository: payload.repository,
    authorEmail: payload.authorEmail ?? null,
    authorName: payload.authorName ?? null,
    timeEntryId: payload.timeEntryId,
    projectId: payload.projectId ?? null,
  });
  return response.data.data as EstimationReferenceHistoryItem & {
    note?: string;
    isActualTrackedEvidence?: boolean;
    gitAuthorEmail?: string | null;
    gitAuthorName?: string | null;
  };
};

export type ActivityConfirmPreview = {
  workActivityId: number;
  totalConfirmedMinutes: number;
  /** EST-02: true when some linked entries were skipped for ACL. */
  partial?: boolean;
  skippedTimeEntryIds?: number[];
  distribution: Array<{
    timeEntryId: number;
    confirmedMinutes: number;
    estimatedMinutesSnapshot: number | null;
    confirmationVersion: number;
    previousConfirmationId: number | null;
  }>;
};

export type ActivityConfirmResult = {
  workActivityId: number;
  totalConfirmedMinutes: number;
  partial?: boolean;
  skippedTimeEntryIds?: number[];
  confirmations: Array<{
    confirmationId: number;
    timeEntryId: number;
    version: number;
    confirmedMinutes: number;
  }>;
};

export const previewWorkActivityConfirmDuration = async (
  workActivityId: number,
  confirmedMinutes: number
) => {
  const response = await api.get(
    `/api/work-activities/${workActivityId}/confirm-duration-preview`,
    { params: { confirmedMinutes } }
  );
  return response.data.data as ActivityConfirmPreview;
};

export const confirmWorkActivityDuration = async (
  workActivityId: number,
  payload: {
    confirmedMinutes: number;
    justification?: string;
    distribution?: Array<{ timeEntryId: number; confirmedMinutes: number }>;
  }
) => {
  const response = await api.post(
    `/api/work-activities/${workActivityId}/confirm-duration`,
    payload
  );
  return response.data.data as ActivityConfirmResult;
};
