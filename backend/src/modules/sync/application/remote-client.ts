import { config } from '../../../config.js';
import type { Grant } from '../../access-control/domain/permissions.js';

/**
 * Cliente HTTP para o servidor remoto (a mesma API do backend). Usado pelo motor
 * de sync do desktop. Autentica por Bearer token e mantem o refresh token
 * (cookie httpOnly) para renovar a sessao sem pedir senha de novo.
 */

export interface RemoteUser {
  id: number;
  uuid: string;
  name: string;
  email: string;
  roleId: number;
}

export interface RemoteSession {
  accessToken: string;
  refreshToken: string | null;
  user: RemoteUser;
}

const cookieName = config.refresh.cookieName;

const extractRefreshCookie = (response: Response): string | null => {
  // getSetCookie existe no undici (Node 18+); fallback para o header simples.
  const cookies =
    typeof (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (response.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];

  for (const cookie of cookies) {
    const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
};

const join = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/+$/, '')}${path}`;

export const remoteLogin = async (
  baseUrl: string,
  email: string,
  password: string
): Promise<RemoteSession> => {
  const response = await fetch(join(baseUrl, '/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Client': 'desktop' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Login remoto falhou (HTTP ${response.status})`);
  }

  const body = (await response.json()) as { data: { token: string; user: RemoteUser } };
  return {
    accessToken: body.data.token,
    refreshToken: extractRefreshCookie(response),
    user: body.data.user,
  };
};

export const remoteRefresh = async (
  baseUrl: string,
  refreshToken: string
): Promise<RemoteSession> => {
  const response = await fetch(join(baseUrl, '/api/auth/refresh'), {
    method: 'POST',
    headers: { 'X-Sync-Client': 'desktop', Cookie: `${cookieName}=${refreshToken}` },
  });

  if (!response.ok) {
    throw new Error(`Sessao remota expirada (HTTP ${response.status})`);
  }

  const body = (await response.json()) as { data: { token: string; user: RemoteUser } };
  return {
    accessToken: body.data.token,
    // O refresh pode rotacionar o token; captura o novo se vier.
    refreshToken: extractRefreshCookie(response) ?? refreshToken,
    user: body.data.user,
  };
};

/** Payload do pull, ja limitado pelo servidor ao escopo do usuario logado. */
export interface RemotePullData {
  access?: { userUuid: string; locale: string; grants: Grant[]; flows: Record<string, boolean> };
  serverTime: string;
  roles: Array<{ id: number; name: string }>;
  users: Array<{
    uuid: string;
    name: string;
    email: string;
    roleId: number;
    managerUuid: string | null;
    isActive: boolean;
    deletedAt: string | null;
  }>;
  clients: Array<{
    uuid: string;
    name: string;
    code: string;
    isActive: boolean;
    deletedAt: string | null;
  }>;
  /** Catalogo de projetos (PRJ-01); opcional em servers antigos. */
  projects?: Array<{
    uuid: string;
    clientUuid: string;
    code: string;
    name: string;
    description: string | null;
    state: string;
    ownerUserUuid: string | null;
    updatedAt: string;
  }>;
  timeEntries: Array<{
    uuid: string;
    userUuid: string;
    clientUuid: string;
    projectUuid?: string | null;
    date: string;
    activityDescription: string;
    durationMinutes: number;
    estimatedDurationMinutes?: number | null;
    confirmedDurationMinutes?: number | null;
    actualTrackedDurationMinutes?: number | null;
    deletedAt: string | null;
    updatedAt: string;
  }>;
}

export const remotePull = async (
  baseUrl: string,
  accessToken: string,
  since: string | null
): Promise<RemotePullData> => {
  const url = new URL(join(baseUrl, '/api/sync/pull'));
  if (since) url.searchParams.set('since', since);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Sync-Client': 'desktop' },
  });
  if (!response.ok) {
    throw new Error(`Pull remoto falhou (HTTP ${response.status})`);
  }
  return ((await response.json()) as { data: unknown }).data as never;
};

export const remotePush = async (
  baseUrl: string,
  accessToken: string,
  timeEntries: unknown[]
): Promise<{ serverTime: string; results: Array<{ uuid: string; status: string }> }> => {
  const response = await fetch(join(baseUrl, '/api/sync/push'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Sync-Client': 'desktop',
    },
    body: JSON.stringify({ timeEntries }),
  });
  if (!response.ok) {
    throw new Error(`Push remoto falhou (HTTP ${response.status})`);
  }
  return ((await response.json()) as { data: unknown }).data as never;
};
