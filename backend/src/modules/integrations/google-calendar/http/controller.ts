import type { Request, Response } from 'express';
import type { IApiResponse } from '../../../../shared/domain/api-response.types.js';
import type { IGoogleCalendarConnection, IGoogleCalendarEvent } from '../domain/google-calendar.types.js';
import { config } from '../../../../config.js';
import { parseDateOnly } from '../../../../shared/domain/date.js';
import { getErrorMessage, resolveErrorStatus } from '../../../../app/errors/app-error.js';
import { googleCalendarProvider, googleCalendarRepository } from '../index.js';
import {
  disconnect,
  fetchEvents,
  getAuthUrl,
  getConnectionStatus,
  handleCallback,
  recordImports,
} from '../application/google-calendar.service.js';
import { createBulkTimeEntries } from '../../../../services/timeentry.service.js';

const MAX_IMPORT_ENTRIES = 100;

export const googleCalendarAuthUrlController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }
    const url = getAuthUrl(req.user.userId, { provider: googleCalendarProvider });
    res.status(200).json({ success: true, data: { url } } as IApiResponse<{ url: string }>);
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const googleCalendarCallbackController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const code = String(req.query.code ?? '');
    const state = String(req.query.state ?? '');

    if (!code || !state) {
      res.redirect(`${config.cors.origin}/calendar-import?error=missing_params`);
      return;
    }

    await handleCallback(code, state, {
      repository: googleCalendarRepository,
      provider: googleCalendarProvider,
    });
    res.redirect(`${config.cors.origin}/calendar-import?connected=true`);
  } catch {
    res.redirect(`${config.cors.origin}/calendar-import?error=auth_failed`);
  }
};

export const googleCalendarStatusController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }
    const connection = await getConnectionStatus(req.user.userId, {
      repository: googleCalendarRepository,
    });
    res.status(200).json({
      success: true,
      data: connection ? { connected: true, ...connection } : { connected: false },
    } as IApiResponse<
      (IGoogleCalendarConnection & { connected: boolean }) | { connected: boolean }
    >);
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const googleCalendarDisconnectController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }
    await disconnect(req.user.userId, {
      repository: googleCalendarRepository,
      provider: googleCalendarProvider,
    });
    res.status(200).json({ success: true, message: 'Disconnected' } as IApiResponse<null>);
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const googleCalendarEventsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const startDate = String(req.query.startDate ?? '');
    const endDate = String(req.query.endDate ?? '');
    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      } as IApiResponse<null>);
      return;
    }

    const parsedStart = parseDateOnly(startDate);
    const parsedEnd = parseDateOnly(endDate);
    if (!parsedStart || !parsedEnd) {
      res.status(400).json({ success: false, error: 'Invalid date format' } as IApiResponse<null>);
      return;
    }

    const diffDays = (parsedEnd.getTime() - parsedStart.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0 || diffDays > 31) {
      res
        .status(400)
        .json({ success: false, error: 'Date range must be 0-31 days' } as IApiResponse<null>);
      return;
    }

    const events = await fetchEvents(req.user.userId, startDate, endDate, {
      repository: googleCalendarRepository,
      provider: googleCalendarProvider,
    });
    res.status(200).json({ success: true, data: events } as IApiResponse<IGoogleCalendarEvent[]>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const googleCalendarImportController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const entries = req.body?.entries as
      | Array<{
          googleEventId: string;
          clientId: number;
          date: string;
          activityDescription: string;
          durationMinutes: number;
        }>
      | undefined;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ success: false, error: 'Entries are required' } as IApiResponse<null>);
      return;
    }
    if (entries.length > MAX_IMPORT_ENTRIES) {
      res.status(400).json({
        success: false,
        error: `Maximum ${MAX_IMPORT_ENTRIES} entries allowed per import`,
      } as IApiResponse<null>);
      return;
    }

    const normalized = entries.map((entry) => ({
      clientId: Number(entry.clientId),
      date: parseDateOnly(entry.date) ?? new Date('invalid'),
      activityDescription: String(entry.activityDescription),
      durationMinutes: Number(entry.durationMinutes),
    }));

    if (normalized.some((entry) => Number.isNaN(entry.date.getTime()))) {
      res.status(400).json({ success: false, error: 'Invalid date' } as IApiResponse<null>);
      return;
    }

    const created = await createBulkTimeEntries(req.user.userId, normalized);
    await recordImports(
      req.user.userId,
      entries.map((entry, index) => ({
        googleEventId: entry.googleEventId,
        timeEntryId: created[index].id,
      })),
      { repository: googleCalendarRepository }
    );

    res.status(201).json({ success: true, data: created } as IApiResponse<typeof created>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};
