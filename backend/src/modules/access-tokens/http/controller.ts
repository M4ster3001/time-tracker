import type { Request, Response } from 'express';
import type { IApiResponse } from '../../../shared/domain/api-response.types.js';
import { resolveErrorStatus, getErrorMessage, ForbiddenError } from '../../../app/errors/app-error.js';
import { scopeFor, scopeCovers, type Grant } from '../../access-control/domain/permissions.js';
import {
  adminRevokeAccessToken,
  generateAccessToken,
  listAccessTokensForUser,
  listAllAccessTokens,
  revokeOwnAccessToken,
} from '../application/access-token.service.js';
import type {
  AccessTokenExpiryDays,
  IAccessToken,
  IAccessTokenWithOwner,
  ICreatedAccessToken,
} from '../domain/access-token.types.js';

export const createAccessTokenController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const { label, expiresInDays, grants } = req.body as {
      label: string;
      expiresInDays: AccessTokenExpiryDays;
      grants: Grant[];
    };

    if (grants.some((grant) => !scopeCovers(scopeFor(req.accessGrants ?? [], grant.permission), grant.scope))) {
      throw new ForbiddenError('TOKEN_SCOPE_NOT_GRANTED');
    }
    const created = await generateAccessToken(req.user.userId, label, expiresInDays, undefined, grants);
    res.status(201).json({ success: true, data: created } as IApiResponse<ICreatedAccessToken>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const listAccessTokensController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const tokens = await listAccessTokensForUser(req.user.userId);
    res.status(200).json({ success: true, data: tokens } as IApiResponse<IAccessToken[]>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const revokeAccessTokenController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const { id } = req.params as unknown as { id: number };
    await revokeOwnAccessToken(req.user.userId, id);
    res.status(200).json({ success: true, data: null } as IApiResponse<null>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const adminListAccessTokensController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const tokens = await listAllAccessTokens();
    res
      .status(200)
      .json({ success: true, data: tokens } as IApiResponse<IAccessTokenWithOwner[]>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const adminRevokeAccessTokenController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params as unknown as { id: number };
    await adminRevokeAccessToken(id);
    res.status(200).json({ success: true, data: null } as IApiResponse<null>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};
