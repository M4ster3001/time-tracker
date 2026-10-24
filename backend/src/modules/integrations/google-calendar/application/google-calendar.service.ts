import jwt from 'jsonwebtoken';
import { config } from '../../../../config.js';
import { decrypt, encrypt } from '../../../../shared/infrastructure/crypto/encryption.js';
import { logger } from '../../../../shared/infrastructure/logger/logger.js';
import type { IGoogleCalendarConnection, IGoogleCalendarEvent } from '../domain/google-calendar.types.js';
import type { GoogleCalendarRepository } from '../domain/repositories/google-calendar.repository.js';
import type {
  FetchEventsDependencies,
  GetAuthUrlDependencies,
  GoogleCalendarDependencies,
  HandleCallbackDependencies,
  RecordImportsDependencies,
} from './google-calendar.service.interfaces.js';

export class GoogleTokenExpiredError extends Error {
  constructor(message = 'Google Calendar token expired, please reconnect') {
    super(message);
    this.name = 'GoogleTokenExpiredError';
  }
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

const toPublicConnection = (
  connection: Awaited<
    ReturnType<GoogleCalendarRepository['findConnectionByUserId']>
  > extends infer T
    ? T extends null
      ? never
      : T
    : never
): IGoogleCalendarConnection => ({
  id: connection.id,
  userId: connection.userId,
  calendarEmail: connection.calendarEmail,
  tokenExpiresAt: connection.tokenExpiresAt,
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt,
});

const getAuthenticatedTokens = async (
  userId: number,
  deps: GoogleCalendarDependencies
): Promise<{ accessToken: string; refreshToken: string; expiryDate: number }> => {
  const connection = await deps.repository.findConnectionByUserId(userId);
  if (!connection) {
    throw new Error('Google Calendar not connected');
  }

  const accessToken = decrypt(connection.accessTokenEnc);
  const refreshToken = decrypt(connection.refreshTokenEnc);
  const shouldRefresh = connection.tokenExpiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;

  if (!shouldRefresh) {
    return {
      accessToken,
      refreshToken,
      expiryDate: connection.tokenExpiresAt.getTime(),
    };
  }

  try {
    const refreshed = await deps.provider.refreshAccessToken(refreshToken);
    if (!refreshed?.accessToken) {
      throw new Error('Failed to refresh access token');
    }

    const newTokenExpiresAt = refreshed.expiryDate
      ? new Date(refreshed.expiryDate)
      : new Date(Date.now() + 3600 * 1000);

    await deps.repository.updateAccessToken(
      userId,
      encrypt(refreshed.accessToken),
      newTokenExpiresAt
    );

    return {
      accessToken: refreshed.accessToken,
      refreshToken,
      expiryDate: newTokenExpiresAt.getTime(),
    };
  } catch (error) {
    logger.error({ err: error }, '[GOOGLE_CALENDAR] Token refresh failed');
    await deps.repository.deleteConnection(userId).catch(() => {});
    throw new GoogleTokenExpiredError(
      'Google Calendar token expired or revoked. Please reconnect your account.'
    );
  }
};

export const getAuthUrl = (userId: number, deps: GetAuthUrlDependencies): string => {
  const state = jwt.sign({ userId }, config.jwt.secret, { expiresIn: '10m' });
  return deps.provider.generateAuthUrl(state);
};

export const handleCallback = async (
  code: string,
  state: string,
  deps: HandleCallbackDependencies
): Promise<IGoogleCalendarConnection> => {
  let payload: { userId: number };
  try {
    payload = jwt.verify(state, config.jwt.secret) as { userId: number };
  } catch {
    throw new Error('Invalid or expired OAuth state');
  }

  const tokens = await deps.provider.exchangeCode(code);
  const connectionInfo = await deps.provider.getConnectionInfo(tokens);
  const tokenExpiresAt = tokens.expiryDate
    ? new Date(tokens.expiryDate)
    : new Date(Date.now() + 3600 * 1000);

  const connection = await deps.repository.upsertConnection({
    userId: payload.userId,
    accessTokenEnc: encrypt(tokens.accessToken),
    refreshTokenEnc: encrypt(tokens.refreshToken),
    tokenExpiresAt,
    calendarEmail: connectionInfo.calendarEmail,
  });

  return toPublicConnection(connection);
};

export const getConnectionStatus = async (
  userId: number,
  deps: Pick<GoogleCalendarDependencies, 'repository'>
): Promise<IGoogleCalendarConnection | null> => {
  const connection = await deps.repository.findConnectionByUserId(userId);
  return connection ? toPublicConnection(connection) : null;
};

export const disconnect = async (
  userId: number,
  deps: GoogleCalendarDependencies
): Promise<void> => {
  const connection = await deps.repository.findConnectionByUserId(userId);
  if (!connection) return;

  try {
    await deps.provider.revokeAccessToken(decrypt(connection.accessTokenEnc));
  } catch {
    // Best effort.
  }

  await deps.repository.deleteConnection(userId);
};

export const fetchEvents = async (
  userId: number,
  startDate: string,
  endDate: string,
  deps: FetchEventsDependencies
): Promise<IGoogleCalendarEvent[]> => {
  const tokens = await getAuthenticatedTokens(userId, deps);
  const events = await deps.provider.listEvents({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiryDate: tokens.expiryDate,
    startDate,
    endDate,
  });
  const importedIds = await deps.repository.findImportedEventIds(
    userId,
    events.map((event) => event.id)
  );

  return events.map((event) => {
    const start = new Date(event.startDateTime);
    const end = new Date(event.endDateTime);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

    return {
      googleEventId: event.id,
      summary: event.summary ?? '(sem titulo)',
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      date: start.toISOString().slice(0, 10),
      durationMinutes: Math.max(15, Math.min(720, durationMinutes)),
      alreadyImported: importedIds.has(event.id),
    };
  });
};

export const recordImports = async (
  userId: number,
  imports: Array<{ googleEventId: string; timeEntryId: number }>,
  deps: RecordImportsDependencies
): Promise<void> => {
  await deps.repository.recordImports(userId, imports);
};
