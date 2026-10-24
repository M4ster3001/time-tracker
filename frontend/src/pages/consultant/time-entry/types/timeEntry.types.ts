export interface ClientOption {
  id: number;
  name: string;
  /** PRJ-01: quando true, novos lançamentos exigem projectId. */
  requireProjectOnEntries?: boolean;
}

export interface ProjectOption {
  id: number;
  code: string;
  name: string;
  state: string;
  clientId: number;
}

export interface TimeEntryLockStatus {
  locked: boolean;
  lockDay: number;
  temporaryUnlock?: boolean;
}

export interface TimeEntryDurationContract {
  estimatedMinutes: number | null;
  confirmedMinutes: number | null;
  actualTrackedMinutes: number | null;
  legacyDeclaredMinutes: number | null;
  closingEligibleMinutes: number;
  actualTrackedStatus: 'NOT_TRACKED' | 'TRACKED' | 'TRACKED_ZERO';
  classification: 'LEGACY_DECLARED' | 'STRUCTURED';
}

export interface TimeEntryPayload {
  clientId: number;
  date: string;
  activityDescription: string;
  durationMinutes: number;
  projectId?: number | null;
}

export interface TimeEntryAiStatus {
  enabled: boolean;
  provider?: string | null;
}
