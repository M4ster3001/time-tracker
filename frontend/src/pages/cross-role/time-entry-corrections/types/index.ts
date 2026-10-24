export interface TimeEntryCorrectionsUserOption {
  id: number;
  name: string;
  roleId?: number;
}

export interface TimeEntryCorrectionsClientOption {
  id: number;
  name: string;
}

export interface TimeEntryCorrectionsSupervisedEntry {
  id: number;
  userId: number;
  clientId: number;
  date: string;
  activityDescription: string;
  durationMinutes: number;
  locked: boolean;
  source?: 'PORTAL' | 'API';
  user: {
    id: number;
    name: string;
    email: string;
  };
  client: {
    id: number;
    name: string;
  };
}

export interface TimeEntryCorrectionsEditDraft {
  id: number;
  userId: number;
  clientId: number;
  date: string;
  activityDescription: string;
  durationMinutes: string;
}

export interface TimeEntryCorrectionsDeleteConfirmState {
  isOpen: boolean;
  entryId: number | null;
  title: string;
}

export interface TimeEntryCorrectionsEntriesResponse {
  items: TimeEntryCorrectionsSupervisedEntry[];
  total: number;
}
