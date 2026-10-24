import api from './api';
import type {
  NotificationPreference,
  NotificationStorageStatus,
  PendingReminder,
} from '../utils/notificationPreferences';

export const getNotificationPreferences = async (): Promise<NotificationPreference> => {
  const response = await api.get('/api/notifications/preferences');
  return response.data.data;
};

export const getNotificationStatus = async (): Promise<NotificationStorageStatus> => {
  const response = await api.get('/api/notifications/status');
  return response.data.data;
};

export const updateNotificationPreferences = async (
  payload: NotificationPreference
): Promise<NotificationPreference> => {
  const response = await api.put('/api/notifications/preferences', payload);
  return response.data.data;
};

export const getPendingNotificationReminders = async (): Promise<PendingReminder[]> => {
  const response = await api.get('/api/notifications/reminders/pending');
  return response.data.data ?? [];
};

export const dismissNotificationReminder = async (reminderId: number): Promise<void> => {
  await api.post(`/api/notifications/reminders/${reminderId}/dismiss`);
};

export const snoozeNotificationReminder = async (
  reminderId: number,
  minutes?: number
): Promise<void> => {
  await api.post(`/api/notifications/reminders/${reminderId}/snooze`, { minutes });
};
