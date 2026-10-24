import { google } from 'googleapis';
import { config } from '../../../../../config.js';
import type {
  GoogleCalendarEventSource,
  GoogleCalendarProvider,
  GoogleCalendarTokens,
} from '../../domain/providers/google-calendar.provider.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events.readonly'];

const createOAuth2Client = () => {
  if (!config.google.clientId || !config.google.clientSecret) {
    throw new Error('Google Calendar integration is not configured');
  }
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
};

export class GoogleOAuthProvider implements GoogleCalendarProvider {
  generateAuthUrl(state: string): string {
    return createOAuth2Client().generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state,
    });
  }

  async exchangeCode(code: string): Promise<GoogleCalendarTokens> {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to obtain Google tokens');
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    };
  }

  async getConnectionInfo(tokens: GoogleCalendarTokens): Promise<{ calendarEmail: string | null }> {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate ?? undefined,
    });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    return { calendarEmail: userInfo.data.email ?? null };
  }

  async revokeAccessToken(accessToken: string): Promise<void> {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    await oauth2Client.revokeToken(accessToken);
  }

  async refreshAccessToken(
    refreshToken: string
  ): Promise<Pick<GoogleCalendarTokens, 'accessToken' | 'expiryDate'> | null> {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    if (!credentials.access_token) return null;
    return {
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date,
    };
  }

  async listEvents(params: {
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
    startDate: string;
    endDate: string;
  }): Promise<GoogleCalendarEventSource[]> {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
      expiry_date: params.expiryDate,
    });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date(`${params.startDate}T00:00:00`).toISOString(),
      timeMax: new Date(`${params.endDate}T23:59:59`).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const events = response.data.items ?? [];
    return events
      .filter((event) => event.start?.dateTime && event.end?.dateTime && event.id)
      .map((event) => ({
        id: event.id!,
        summary: event.summary,
        startDateTime: event.start!.dateTime!,
        endDateTime: event.end!.dateTime!,
      }));
  }
}
