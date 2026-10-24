import type { Request, Response } from 'express';
import type { IApiResponse } from '../../../shared/domain/api-response.types.js';
import type { IClient } from '../domain/client.types.js';
import type { IUser } from '../../users/domain/user.types.js';
import { getErrorMessage, resolveErrorStatus } from '../../../app/errors/app-error.js';
import {
  createClient,
  deleteClient,
  getClientById,
  getClientUsers,
  listClients,
  updateClient,
} from '../application/client.service.js';
import type { PaginatedResult } from '../application/client.service.interfaces.js';

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

const parseLockDay = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const normalized = Math.round(parsed);
  if (normalized < 1 || normalized > 28) return undefined;
  return normalized;
};

const parsePaysOvertime = (value: unknown): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
};

export const listClientsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const includeInactive =
      req.query.includeInactive !== undefined
        ? String(req.query.includeInactive) === 'true'
        : false;
    const isActive =
      req.query.isActive !== undefined ? String(req.query.isActive) === 'true' : undefined;
    const page = parseNumber(req.query.page);
    const limit = parseNumber(req.query.limit);

    const result = await listClients(
      { search, includeInactive, isActive },
      { page: page ?? undefined, limit: limit ?? undefined }
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    } as IApiResponse<IClient[]> & {
      pagination: PaginatedResult<IClient>['pagination'];
    });
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const createClientController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, code, lockDay, paysOvertime, requireProjectOnEntries, isActive } = req.body;
    if (!name || !code) {
      res
        .status(400)
        .json({ success: false, error: 'Missing required fields' } as IApiResponse<null>);
      return;
    }

    const parsedLockDay = parseLockDay(lockDay);
    if (parsedLockDay === undefined && lockDay !== undefined) {
      res
        .status(400)
        .json({ success: false, error: 'Invalid lockDay (must be 1-28)' } as IApiResponse<null>);
      return;
    }
    const parsedPaysOvertime = parsePaysOvertime(paysOvertime);
    if (parsedPaysOvertime === undefined && paysOvertime !== undefined) {
      res.status(400).json({ success: false, error: 'Invalid paysOvertime' } as IApiResponse<null>);
      return;
    }

    const parsedIsActive = typeof isActive === 'boolean' ? isActive : undefined;
    const client = await createClient({
      name: String(name),
      code: String(code),
      lockDay: parsedLockDay,
      ...(parsedPaysOvertime !== undefined ? { paysOvertime: parsedPaysOvertime } : {}),
      ...(typeof requireProjectOnEntries === 'boolean'
        ? { requireProjectOnEntries }
        : {}),
      ...(parsedIsActive !== undefined ? { isActive: parsedIsActive } : {}),
    });
    res.status(201).json({ success: true, data: client } as IApiResponse<IClient>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const getClientController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    const client = await getClientById(id);
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' } as IApiResponse<null>);
      return;
    }

    res.status(200).json({ success: true, data: client } as IApiResponse<IClient>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const updateClientController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    const { name, code, lockDay, paysOvertime, requireProjectOnEntries, isActive } = req.body;
    const parsedLockDay = parseLockDay(lockDay);
    if (parsedLockDay === undefined && lockDay !== undefined) {
      res
        .status(400)
        .json({ success: false, error: 'Invalid lockDay (must be 1-28)' } as IApiResponse<null>);
      return;
    }
    const parsedPaysOvertime = parsePaysOvertime(paysOvertime);
    if (parsedPaysOvertime === undefined && paysOvertime !== undefined) {
      res.status(400).json({ success: false, error: 'Invalid paysOvertime' } as IApiResponse<null>);
      return;
    }
    const parsedIsActive = typeof isActive === 'boolean' ? isActive : undefined;

    const client = await updateClient(
      id,
      {
        name: name ? String(name) : undefined,
        code: code ? String(code) : undefined,
        ...(lockDay !== undefined ? { lockDay: parsedLockDay } : {}),
        ...(parsedPaysOvertime !== undefined ? { paysOvertime: parsedPaysOvertime } : {}),
        ...(typeof requireProjectOnEntries === 'boolean'
          ? { requireProjectOnEntries }
          : {}),
        ...(parsedIsActive !== undefined ? { isActive: parsedIsActive } : {}),
      },
      { actorUserId: req.user?.userId }
    );

    res.status(200).json({ success: true, data: client } as IApiResponse<IClient>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const deleteClientController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    await deleteClient(id, req.user?.userId);
    res.status(200).json({ success: true, message: 'Deleted' } as IApiResponse<null>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const getClientUsersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    const users = await getClientUsers(id);
    res.status(200).json({ success: true, data: users } as IApiResponse<IUser[]>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};
