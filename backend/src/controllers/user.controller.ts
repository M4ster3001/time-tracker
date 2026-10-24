import type { Request, Response } from 'express';
import type { IApiResponse } from '../shared/domain/api-response.types.js';
import type { IClient } from '../modules/clients/domain/client.types.js';
import { resolveErrorStatus, getErrorMessage } from '../app/errors/app-error.js';
import { canViewerAccessUserClients, getUserClients } from '../services/user.service.js';

export const getUserClientsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const includeHistorical =
      req.query.includeHistorical === undefined
        ? true
        : String(req.query.includeHistorical).toLowerCase() !== 'false';

    if (year !== undefined && Number.isNaN(year)) {
      res.status(400).json({ success: false, error: 'Invalid year' } as IApiResponse<null>);
      return;
    }
    if (month !== undefined && Number.isNaN(month)) {
      res.status(400).json({ success: false, error: 'Invalid month' } as IApiResponse<null>);
      return;
    }

    const canAccess = await canViewerAccessUserClients(req.user, id);
    if (!canAccess) {
      res.status(403).json({ success: false, error: 'Forbidden' } as IApiResponse<null>);
      return;
    }

    const clients = await getUserClients(id, year, month, includeHistorical);

    res.status(200).json({ success: true, data: clients } as IApiResponse<IClient[]>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};
