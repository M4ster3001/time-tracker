export type GoogleCalendarTokens = {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number | null;
};

export type GoogleCalendarConnectionInfo = {
  calendarEmail: string | null;
};

export type GoogleCalendarEventSource = {
  id: string;
  summary?: string | null;
  startDateTime: string;
  endDateTime: string;
};

export interface GoogleCalendarProvider {
  generateAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<GoogleCalendarTokens>;
  getConnectionInfo(tokens: GoogleCalendarTokens): Promise<GoogleCalendarConnectionInfo>;
  revokeAccessToken(accessToken: string): Promise<void>;
  refreshAccessToken(
    refreshToken: string
  ): Promise<Pick<GoogleCalendarTokens, 'accessToken' | 'expiryDate'> | null>;
  listEvents(params: {
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
    startDate: string;
    endDate: string;
  }): Promise<GoogleCalendarEventSource[]>;
}
