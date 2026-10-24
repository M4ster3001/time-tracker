export type TimeEntrySource = 'PORTAL' | 'API';

export interface ITimeEntry {
  id: number;
  userId: number;
  clientId: number;
  date: Date;
  activityDescription: string;
  durationMinutes: number;
  estimatedDurationMinutes?: number | null;
  confirmedDurationMinutes?: number | null;
  actualTrackedDurationMinutes?: number | null;
  confirmedAt?: Date | null;
  confirmedByUserId?: number | null;
  projectId?: number | null;
  source: TimeEntrySource;
  createdAt: Date;
  updatedAt: Date;
}
