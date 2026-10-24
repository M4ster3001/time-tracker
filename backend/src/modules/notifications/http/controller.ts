import type { Request, Response } from 'express';
import type { IApiResponse } from '../../../shared/domain/api-response.types.js';
import { getErrorMessage, resolveErrorStatus } from '../../../app/errors/app-error.js';
import {
  dismissNotificationReminder,
  getNotificationPreferences,
  getNotificationStorageStatus,
  listPendingNotificationReminders,
  snoozeNotificationReminder,
  updateNotificationPreferences,
} from '../application/notification-reminder.service.js';

const assertEligibleRequestUser = (req: Request, res: Response): number | null => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
    return null;
  }
  return req.user.userId;
};

export const getNotificationPreferencesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = assertEligibleRequestUser(req, res);
    if (!userId) return;

    const preference = await getNotificationPreferences(userId);
    res.status(200).json({ success: true, data: preference } as IApiResponse<typeof preference>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const getNotificationStatusController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const status = await getNotificationStorageStatus();
    res.status(200).json({ success: true, data: status } as IApiResponse<typeof status>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const updateNotificationPreferencesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = assertEligibleRequestUser(req, res);
    if (!userId) return;

    const payload = req.body as {
      enabled?: boolean;
      times?: string[];
      snoozeMinutes?: number;
    };

    const preference = await updateNotificationPreferences(userId, payload);
    res.status(200).json({ success: true, data: preference } as IApiResponse<typeof preference>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const listPendingNotificationRemindersController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = assertEligibleRequestUser(req, res);
    if (!userId) return;

    const reminders = await listPendingNotificationReminders(userId);
    res.status(200).json({ success: true, data: reminders } as IApiResponse<typeof reminders>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const dismissNotificationReminderController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = assertEligibleRequestUser(req, res);
    if (!userId) return;

    const reminderId = Number(req.params.id);
    if (!Number.isInteger(reminderId) || reminderId <= 0) {
      res.status(400).json({ success: false, error: 'Invalid reminder id' } as IApiResponse<null>);
      return;
    }

    await dismissNotificationReminder(userId, reminderId);
    res.status(200).json({ success: true } as IApiResponse<null>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const snoozeNotificationReminderController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = assertEligibleRequestUser(req, res);
    if (!userId) return;

    const reminderId = Number(req.params.id);
    if (!Number.isInteger(reminderId) || reminderId <= 0) {
      res.status(400).json({ success: false, error: 'Invalid reminder id' } as IApiResponse<null>);
      return;
    }

    const minutes =
      req.body && typeof (req.body as { minutes?: unknown }).minutes !== 'undefined'
        ? Number((req.body as { minutes?: unknown }).minutes)
        : undefined;

    await snoozeNotificationReminder(userId, reminderId, minutes);
    res.status(200).json({ success: true } as IApiResponse<null>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};
