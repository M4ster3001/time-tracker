import type { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyToken } from '../../../shared/infrastructure/crypto/jwt.js';
import {
  ACCESS_TOKEN_PREFIX,
  verifyAccessToken,
} from '../../../modules/access-tokens/application/access-token.service.js';
import { ForbiddenError, UnauthorizedError } from '../../errors/app-error.js';
import { authUserRepository } from '../../../modules/auth/infrastructure/repositories/prisma-auth-user.repository.js';

/**
 * Middleware to verify a bearer token: either a JWT (browser login) or a
 * personal access token (`ttpat_...`, used by external tools/scripts).
 */
export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    next(new UnauthorizedError('Unauthorized'));
    return;
  }

  if (token.startsWith(ACCESS_TOKEN_PREFIX)) {
    try {
      const payload = await verifyAccessToken(token);
      if (!payload) {
        next(new UnauthorizedError('Invalid token'));
        return;
      }
      req.user = payload;
      req.authTokenType = 'pat';
      next();
    } catch (error) {
      next(error);
    }
    return;
  }

  const payload = verifyToken(token);

  if (!payload) {
    next(new UnauthorizedError('Invalid token'));
    return;
  }

  try {
    const user = await authUserRepository.findByIdWithRole(payload.userId);
    if (!user || !user.isActive || user.deletedAt) {
      next(new UnauthorizedError('User is inactive'));
      return;
    }
    // Authorize against current server state, never the role cached in a JWT.
    req.user = { userId: user.id, email: user.email, roleId: user.roleId };
    req.authTokenType = 'jwt';
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user is admin
 */
export const adminMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || req.user.roleId !== 1) {
    next(new ForbiddenError('Forbidden'));
    return;
  }

  next();
};

/**
 * Middleware to check if user is manager or admin
 */
export const managerMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || (req.user.roleId !== 1 && req.user.roleId !== 2)) {
    next(new ForbiddenError('Forbidden'));
    return;
  }

  next();
};
