import type { Request, Response } from 'express';
import type { IApiResponse } from '../../../shared/domain/api-response.types.js';
import type { IAuditLog } from '../domain/audit-log.types.js';
import { resolveErrorStatus, getErrorMessage } from '../../../app/errors/app-error.js';
import { listAuditLogs } from '../application/audit-log.service.js';

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  if (Number.isNaN(num)) return undefined;
  return num;
};

export const listAuditLogsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseNumber(req.query.userId);
    const action = req.query.action ? String(req.query.action) : undefined;
    const limit = parseNumber(req.query.limit);

    const logs = await listAuditLogs({ userId, action, limit });
    res.status(200).json({ success: true, data: logs } as IApiResponse<IAuditLog[]>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};
