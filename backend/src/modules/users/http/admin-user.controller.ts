import type { Request, Response } from 'express';
import type { IApiResponse } from '../../../shared/domain/api-response.types.js';
import type { IUserWithRole } from '../domain/user.types.js';
import { getErrorMessage, resolveErrorStatus } from '../../../app/errors/app-error.js';
import {
  addClientToUser,
  canCreateRole,
  changeUserPassword,
  createUser,
  deleteUser,
  getUserById,
  listUserClients,
  listUsers,
  removeClientFromUser,
  updateUser,
} from '../application/user.service.js';
import type { PaginatedResult } from '../application/user.service.interfaces.js';

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

export const listUsersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const roleId = parseNumber(req.query.roleId);
    const managerId = parseNumber(req.query.managerId);
    const search = req.query.search ? String(req.query.search) : undefined;
    const includeInactive =
      req.query.includeInactive !== undefined
        ? String(req.query.includeInactive) === 'true'
        : false;
    const isActive =
      req.query.isActive !== undefined ? String(req.query.isActive) === 'true' : undefined;
    const page = parseNumber(req.query.page);
    const limit = parseNumber(req.query.limit);

    const result = await listUsers(
      { roleId, managerId, search, includeInactive, isActive },
      { page: page ?? undefined, limit: limit ?? undefined }
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    } as IApiResponse<IUserWithRole[]> & {
      pagination: PaginatedResult<IUserWithRole>['pagination'];
    });
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const createUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, roleId, managerId } = req.body;
    if (!name || !email || !password || !roleId) {
      res
        .status(400)
        .json({ success: false, error: 'Missing required fields' } as IApiResponse<null>);
      return;
    }

    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const targetRoleId = Number(roleId);
    if (!canCreateRole(req.user.roleId, targetRoleId)) {
      res.status(403).json({
        success: false,
        error: 'You do not have permission to create users with this role',
      } as IApiResponse<null>);
      return;
    }

    const user = await createUser({
      name: String(name),
      email: String(email),
      password: String(password),
      roleId: targetRoleId,
      managerId: managerId !== undefined ? Number(managerId) : null,
    });

    res.status(201).json({ success: true, data: user } as IApiResponse<IUserWithRole>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const getUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    const user = await getUserById(id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' } as IApiResponse<null>);
      return;
    }

    res.status(200).json({ success: true, data: user } as IApiResponse<IUserWithRole>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const updateUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    const { name, email, roleId, managerId, isActive } = req.body;
    const user = await updateUser(
      id,
      {
        name: name ? String(name) : undefined,
        email: email ? String(email) : undefined,
        roleId: roleId ? Number(roleId) : undefined,
        managerId: managerId !== undefined ? Number(managerId) : undefined,
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
      { actorUserId: req.user?.userId }
    );

    res.status(200).json({ success: true, data: user } as IApiResponse<IUserWithRole>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const deleteUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    await deleteUser(id, req.user?.userId);
    res.status(200).json({ success: true, message: 'Deleted' } as IApiResponse<null>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const addUserClientController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const clientId = Number(req.params.clientId);
    if (Number.isNaN(userId) || Number.isNaN(clientId)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    await addClientToUser(userId, clientId);
    res.status(200).json({ success: true, message: 'Linked' } as IApiResponse<null>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const removeUserClientController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const clientId = Number(req.params.clientId);
    if (Number.isNaN(userId) || Number.isNaN(clientId)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    await removeClientFromUser(userId, clientId);
    res.status(200).json({ success: true, message: 'Unlinked' } as IApiResponse<null>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const listUserClientsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      res.status(400).json({ success: false, error: 'Invalid id' } as IApiResponse<null>);
      return;
    }

    const clientIds = await listUserClients(userId);
    res.status(200).json({ success: true, data: clientIds } as IApiResponse<number[]>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const changePasswordController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const { oldPassword, newPassword } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    if (!newPassword) {
      res
        .status(400)
        .json({ success: false, error: 'New password is required' } as IApiResponse<null>);
      return;
    }

    const isAdminAction = req.user.userId !== userId && req.user.roleId === 1;

    await changeUserPassword(
      userId,
      String(newPassword),
      oldPassword ? String(oldPassword) : undefined,
      {
        isAdminAction,
        adminId: isAdminAction ? req.user.userId : undefined,
      }
    );
    res.status(200).json({ success: true, message: 'Password updated' } as IApiResponse<null>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};
