export interface ITemporaryUnlock {
  id: number;
  userId: number;
  clientId: number;
  grantedBy: number;
  periodYear: number;
  periodMonth: number;
  reason: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ITemporaryUnlockEdit {
  id: number;
  temporaryUnlockId: number;
  timeEntryId: number | null;
  action: string;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: Date;
}
