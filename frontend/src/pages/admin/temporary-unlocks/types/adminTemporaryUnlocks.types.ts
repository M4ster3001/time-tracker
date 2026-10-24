export interface TemporaryUnlock {
  id: number;
  userId: number;
  clientId: number;
  grantedBy: number;
  periodYear: number;
  periodMonth: number;
  reason: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  userName: string;
  clientName: string;
  adminName: string;
  editCount: number;
}

export interface UnlockEdit {
  id: number;
  temporaryUnlockId: number;
  timeEntryId: number | null;
  action: string;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: string;
}

export interface UnlockDetails extends TemporaryUnlock {
  edits: UnlockEdit[];
}

export interface UserOption {
  id: number;
  name: string;
  email: string;
}

export interface ClientOption {
  id: number;
  name: string;
  code: string;
}
