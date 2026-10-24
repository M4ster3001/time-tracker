export interface IGoogleCalendarConnection {
  id: number;
  userId: number;
  calendarEmail: string | null;
  tokenExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGoogleCalendarEvent {
  googleEventId: string;
  summary: string;
  startDateTime: string;
  endDateTime: string;
  date: string;
  durationMinutes: number;
  alreadyImported: boolean;
}
