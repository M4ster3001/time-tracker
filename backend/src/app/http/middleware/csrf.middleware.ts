import type { Request, Response, NextFunction } from 'express';
import { config } from '../../../config.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { extractTokenFromHeader } from '../../../shared/infrastructure/crypto/jwt.js';
import {
  ACCESS_TOKEN_PREFIX,
  verifyAccessToken,
} from '../../../modules/access-tokens/application/access-token.service.js';
import { isAllowedBrowserOrigin } from '../../../shared/infrastructure/http/allowed-origin.js';
import { ForbiddenError } from '../../errors/app-error.js';

const isAllowedOrigin = (value: string | undefined): boolean =>
  isAllowedBrowserOrigin(value, {
    allowlist: config.cors.origins,
    allowPrivateLan: config.cors.allowPrivateLan,
  });

// State-changing HTTP methods that require CSRF protection
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * CSRF protection middleware using Origin/Referer validation
 * Applied to all state-changing requests (POST, PUT, PATCH, DELETE)
 * SEC-HIGH-03: Enforced consistently in all environments
 */
/**
 * Cabecalho enviado pelo motor de sync do desktop (cliente Node) ao chamar a API
 * remota. Um navegador nao consegue enviar cabecalho customizado cross-origin sem
 * um preflight CORS bem-sucedido, entao a presenca dele ja prova que a requisicao
 * nao e um CSRF -- e a defesa por "custom request header" recomendada pela OWASP.
 *
 * `/api/sync/*` NAO e isento por path: sync autentica so por Bearer (JWT/PAT),
 * nunca por cookie de access token (`auth.middleware.ts`). Desktop envia
 * `X-Sync-Client` em push/pull/refresh (`remote-client.ts`).
 */
const SYNC_CLIENT_HEADER = 'x-sync-client';

export const csrfOriginMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Only check state-changing methods
  if (!STATE_CHANGING_METHODS.includes(req.method)) {
    next();
    return;
  }

  // Cliente de sincronizacao (nao-navegador): ver SYNC_CLIENT_HEADER.
  if (req.get(SYNC_CLIENT_HEADER)) {
    next();
    return;
  }

  // Token de acesso pessoal (ferramenta externa, ex: script/IA lendo commits):
  // e um segredo que so quem o possui consegue enviar, nao e uma credencial
  // ambiente (cookie) anexada automaticamente pelo navegador, entao CSRF nao
  // se aplica a ele por definicao. Valida o token de verdade (nao so o prefixo)
  // antes de isentar, pra nao dar pra contornar so com um header forjado.
  const bearerToken = extractTokenFromHeader(req.headers.authorization);
  if (bearerToken?.startsWith(ACCESS_TOKEN_PREFIX)) {
    const payload = await verifyAccessToken(bearerToken).catch(() => null);
    if (payload) {
      next();
      return;
    }
  }

  const origin = req.get('origin');
  const referer = req.get('referer');

  // Allow if Origin or Referer matches allowed origin
  if (isAllowedOrigin(origin) || isAllowedOrigin(referer)) {
    next();
    return;
  }

  // Log blocked request for security monitoring
  logger.warn(
    `[CSRF] Blocked request: ${req.method} ${req.path} from origin=${origin}, referer=${referer}`
  );
  res.locals.requestId = res.locals.requestId ?? req.requestId;
  next(new ForbiddenError('Invalid origin - CSRF protection'));
};
