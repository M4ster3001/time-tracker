export interface INotificationPreference {
  enabled: boolean;
  times: string[];
  snoozeMinutes: number;
}

export interface IPendingReminder {
  id: number;
  clientId: number;
  clientName: string;
  date: string;
  scheduledTime: string;
  missingMinutes: number;
  status: 'pending' | 'snoozed';
  launchUrl: string;
}
