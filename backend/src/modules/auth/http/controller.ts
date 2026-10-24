import type { NextFunction, Request, Response } from 'express';
import {
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshTokens,
} from '../../../services/refresh-token.service.js';
import { config } from '../../../config.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import { generateToken } from '../../../shared/infrastructure/crypto/jwt.js';
import { sendSuccess } from '../../../app/http/presenters/api.presenter.js';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '../../../app/errors/app-error.js';
import { authAuditRepository } from '../infrastructure/repositories/prisma-auth-audit.repository.js';
import {
  getSetupStatus,
  getUserById,
  login,
  register,
  setupInitialAdmin,
  unlockUserAccount,
} from '../application/auth.service.js';

const getClientIp = (req: Request): string | null => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return req.ip || null;
};

const getRefreshMetadata = (req: Request) => ({
  userAgent: req.get('user-agent') ?? null,
  ip: getClientIp(req),
  deviceLabel: req.get('x-device-label') ?? req.get('x-device-name') ?? null,
});

const logAuthEvent = async (
  userId: number | null,
  action: string,
  status: 'success' | 'failure',
  details?: string
) => authAuditRepository.log({ userId, action, status, details });

export const setupStatusController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    sendSuccess(res, 200, { ...await getSetupStatus(), registrationEnabled: (await getFlows()).publicRegistration });
  } catch (error) {
    next(error);
  }
};

export const setupController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await setupInitialAdmin(req.body);
    const refresh = await createRefreshToken(result.user.id, getRefreshMetadata(req));
    res.cookie(config.refresh.cookieName, refresh.token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
      maxAge: config.refresh.ttlDays * 24 * 60 * 60 * 1000,
    });

    await logAuthEvent(result.user.id, 'AUTH_SETUP_ADMIN', 'success');
    sendSuccess(res, 201, result);
  } catch (error) {
    await logAuthEvent(
      null,
      'AUTH_SETUP_ADMIN',
      'failure',
      error instanceof Error ? error.message : undefined
    );
    next(error);
  }
};

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await getFlows()).publicRegistration || (await getSetupStatus()).needsSetup) {
      throw new ForbiddenError('PUBLIC_REGISTRATION_DISABLED');
    }
    const result = await register(req.body);
    const refresh = await createRefreshToken(result.user.id, getRefreshMetadata(req));
    res.cookie(config.refresh.cookieName, refresh.token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
      maxAge: config.refresh.ttlDays * 24 * 60 * 60 * 1000,
    });

    await logAuthEvent(result.user.id, 'AUTH_REGISTER', 'success');
    sendSuccess(res, 201, result);
  } catch (error) {
    await logAuthEvent(
      null,
      'AUTH_REGISTER',
      'failure',
      error instanceof Error ? error.message : undefined
    );
    next(error);
  }
};

export const loginController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await login(req.body);
    const refresh = await createRefreshToken(result.user.id, getRefreshMetadata(req));
    res.cookie(config.refresh.cookieName, refresh.token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
      maxAge: config.refresh.ttlDays * 24 * 60 * 60 * 1000,
    });

    await logAuthEvent(result.user.id, 'AUTH_LOGIN', 'success');
    sendSuccess(res, 200, result);
  } catch (error) {
    await logAuthEvent(
      null,
      'AUTH_LOGIN',
      'failure',
      error instanceof Error ? error.message : undefined
    );
    next(error);
  }
};

export const meController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');

    const user = await getUserById(req.user.userId);
    if (!user) throw new NotFoundError('User not found');

    sendSuccess(res, 200, user);
  } catch (error) {
    next(error);
  }
};

export const refreshController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.[config.refresh.cookieName];
    if (!token) throw new UnauthorizedError('Unauthorized');

    const rotated = await rotateRefreshToken(token, getRefreshMetadata(req));
    if (!rotated) {
      await logAuthEvent(null, 'AUTH_REFRESH', 'failure', 'Invalid refresh token');
      throw new UnauthorizedError('Unauthorized');
    }

    const user = await getUserById(rotated.userId);
    if (!user) {
      await logAuthEvent(rotated.userId, 'AUTH_REFRESH', 'failure', 'User not found');
      throw new UnauthorizedError('Unauthorized');
    }

    res.cookie(config.refresh.cookieName, rotated.newToken, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
      maxAge: config.refresh.ttlDays * 24 * 60 * 60 * 1000,
    });

    await logAuthEvent(user.id, 'AUTH_REFRESH', 'success');
    sendSuccess(res, 200, {
      token: generateToken({
        userId: user.id,
        email: user.email,
        roleId: user.roleId,
      }),
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const logoutController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.[config.refresh.cookieName];
    if (token) await revokeRefreshToken(token);

    res.clearCookie(config.refresh.cookieName, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
    });
    await logAuthEvent(req.user?.userId ?? null, 'AUTH_LOGOUT', 'success');
    sendSuccess(res, 200, undefined, 'Logged out');
  } catch (error) {
    await logAuthEvent(
      req.user?.userId ?? null,
      'AUTH_LOGOUT',
      'failure',
      error instanceof Error ? error.message : undefined
    );
    next(error);
  }
};

export const revokeUserSessionsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = Number(req.params.userId);
    await revokeUserRefreshTokens(userId);
    await logAuthEvent(req.user?.userId ?? null, 'AUTH_REVOKE', 'success', `target=${userId}`);
    sendSuccess(res, 200, undefined, 'Sessions revoked');
  } catch (error) {
    await logAuthEvent(
      req.user?.userId ?? null,
      'AUTH_REVOKE',
      'failure',
      error instanceof Error ? error.message : undefined
    );
    next(error);
  }
};

export const unlockUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = Number(req.params.userId);
    await unlockUserAccount(userId);
    await logAuthEvent(req.user?.userId ?? null, 'AUTH_UNLOCK', 'success', `target=${userId}`);
    sendSuccess(res, 200, undefined, 'User account unlocked');
  } catch (error) {
    await logAuthEvent(
      req.user?.userId ?? null,
      'AUTH_UNLOCK',
      'failure',
      error instanceof Error ? error.message : undefined
    );
    next(error);
  }
};
