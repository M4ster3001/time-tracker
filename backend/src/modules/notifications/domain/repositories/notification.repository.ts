export type ReminderStatus = 'PENDING' | 'DISMISSED' | 'SNOOZED' | 'COMPLETED';

export interface PreferenceRow {
  enabled: boolean;
  timesJson: string;
  snoozeMinutes: number;
}

export interface AllocationRow {
  clientId: number;
}

export interface ReminderRow {
  id: number;
  clientId: number;
  reminderDate: Date;
  scheduledTime: string;
  status: ReminderStatus;
  snoozedUntil: Date | null;
  triggeredAt: Date | null;
}

export interface ClientRow {
  id: number;
  name: string;
}

export interface LinkedClientRow extends ClientRow {
  isActive: boolean;
}

export interface WorkedMinutesRow {
  clientId: number;
  _sum: { durationMinutes: number | null };
}

export interface NotificationRepository {
  findExistingTables(tableNames: readonly string[]): Promise<Set<string>>;

  findEligibleUser(userId: number): Promise<{ roleId: number; isActive: boolean } | null>;

  findPreferenceRow(userId: number): Promise<PreferenceRow | null>;

  upsertPreferenceRow(
    userId: number,
    enabled: boolean,
    timesJson: string,
    snoozeMinutes: number
  ): Promise<void>;

  findActiveLinkedClients(userId: number): Promise<LinkedClientRow[]>;

  findAllocatedClientIds(
    userId: number,
    candidateClientIds: number[],
    todayUtc: Date
  ): Promise<number[]>;

  sumWorkedMinutesByClient(
    userId: number,
    clientIds: number[],
    date: Date
  ): Promise<WorkedMinutesRow[]>;

  markRemindersCompleted(
    userId: number,
    todayUtc: Date,
    clientIds: number[]
  ): Promise<void>;

  findReminders(userId: number, todayUtc: Date, clientIds: number[]): Promise<ReminderRow[]>;

  createReminder(
    userId: number,
    clientId: number,
    todayUtc: Date,
    scheduledTime: string
  ): Promise<void>;

  findReminder(
    userId: number,
    clientId: number,
    todayUtc: Date,
    scheduledTime: string
  ): Promise<ReminderRow | null>;

  reactivateSnoozedReminder(reminderId: number): Promise<void>;

  markReminderTriggered(reminderId: number): Promise<void>;

  findReminderById(userId: number, reminderId: number): Promise<ReminderRow | null>;

  dismissReminder(reminderId: number): Promise<void>;

  snoozeReminder(reminderId: number, snoozedUntil: Date): Promise<void>;
}
