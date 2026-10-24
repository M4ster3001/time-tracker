export interface NotificationPreference {
  enabled: boolean;
  times: string[];
  snoozeMinutes: number;
}

export interface PendingReminder {
  id: number;
  clientId: number;
  clientName: string;
  date: string;
  scheduledTime: string;
  missingMinutes: number;
  status: 'pending' | 'snoozed';
  launchUrl: string;
}

export interface NotificationStorageStatus {
  ready: boolean;
  missingTables: string[];
  defaultTimes: string[];
  defaultSnoozeMinutes: number;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const normalizeNotificationTimes = (times: string[]): string[] =>
  Array.from(
    new Set(times.map((time) => time.trim()).filter((time) => TIME_PATTERN.test(time)))
  ).sort();

export const browserSupportsNotifications = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

export const getNotificationPermission = (): NotificationPermission => {
  if (!browserSupportsNotifications()) return 'denied';
  return window.Notification.permission;
};
