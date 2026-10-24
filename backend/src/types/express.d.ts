import type { IAuthPayload } from '../modules/auth/domain/auth.types.js';
import type { Logger } from 'pino';

declare module 'express-serve-static-core' {
  interface Request {
    user?: IAuthPayload;
    /** Como o bearer token foi verificado: login normal (JWT) ou token de acesso pessoal (PAT). */
    authTokenType?: 'jwt' | 'pat';
    accessGrants?: import('../modules/access-control/domain/permissions.js').Grant[];
    authenticatedRoleId?: number;
    requestId?: string;
    log?: Logger;
  }

  interface Locals {
    requestId?: string;
  }
}
