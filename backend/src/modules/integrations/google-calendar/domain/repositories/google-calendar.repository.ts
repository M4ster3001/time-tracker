export type GoogleCalendarConnectionRecord = {
  id: number;
  userId: number;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  tokenExpiresAt: Date;
  calendarEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface GoogleCalendarRepository {
  upsertConnection(params: {
    userId: number;
    accessTokenEnc: string;
    refreshTokenEnc: string;
    tokenExpiresAt: Date;
    calendarEmail: string | null;
  }): Promise<GoogleCalendarConnectionRecord>;
  findConnectionByUserId(userId: number): Promise<GoogleCalendarConnectionRecord | null>;
  updateAccessToken(userId: number, accessTokenEnc: string, tokenExpiresAt: Date): Promise<void>;
  deleteConnection(userId: number): Promise<void>;
  findImportedEventIds(userId: number, googleEventIds: string[]): Promise<Set<string>>;
  recordImports(
    userId: number,
    imports: Array<{ googleEventId: string; timeEntryId: number }>
  ): Promise<void>;
}
