import type { IGoogleCalendarConnection, IGoogleCalendarEvent } from '../domain/google-calendar.types.js';
import type { GoogleCalendarProvider } from '../domain/providers/google-calendar.provider.js';
import type { GoogleCalendarRepository } from '../domain/repositories/google-calendar.repository.js';

export interface GoogleCalendarDependencies {
  repository: GoogleCalendarRepository;
  provider: GoogleCalendarProvider;
}

export interface GetAuthUrlDependencies {
  provider: GoogleCalendarProvider;
}

export interface HandleCallbackDependencies {
  repository: GoogleCalendarRepository;
  provider: GoogleCalendarProvider;
}

export interface FetchEventsDependencies {
  repository: GoogleCalendarRepository;
  provider: GoogleCalendarProvider;
}

export interface RecordImportsDependencies {
  repository: GoogleCalendarRepository;
}

export type GoogleCalendarConnectionResult = IGoogleCalendarConnection;

export type GoogleCalendarEventsResult = IGoogleCalendarEvent;
