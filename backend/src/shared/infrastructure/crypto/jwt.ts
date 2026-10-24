import jwt from 'jsonwebtoken';
import { config } from '../../../config.js';
import type { IAuthPayload } from '../../../modules/auth/domain/auth.types.js';

export const generateToken = (payload: IAuthPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiration,
  });
};

export const verifyToken = (token: string): IAuthPayload | null => {
  try {
    return jwt.verify(token, config.jwt.secret) as IAuthPayload;
  } catch (_error) {
    return null;
  }
};

export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
};
