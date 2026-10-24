/**
 * Guards the destructive demo seed. Demo seed deletes users/clients/entries.
 * Requires double opt-in and refuses DATABASE_URL that looks like a shared/prod host.
 */

const LOCAL_HOST_MARKERS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
const PROD_URL_MARKERS = ['prod', 'production', 'rds.amazonaws.com', 'azure.com', 'neon.tech'];

export const DEMO_SEED_CONFIRM_VALUE = 'I_UNDERSTAND_DELETE_ALL';

export type DemoSeedEnv = {
  NODE_ENV?: string;
  ALLOW_DEMO_SEED?: string;
  CONFIRM_DEMO_SEED_DELETE?: string;
  DATABASE_URL?: string;
};

export const isLocalDatabaseUrl = (databaseUrl: string | undefined): boolean => {
  if (!databaseUrl || !databaseUrl.trim()) return false;
  const lower = databaseUrl.toLowerCase();
  try {
    const parsed = new URL(lower.replace(/^mysql:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://'));
    const host = parsed.hostname;
    if (LOCAL_HOST_MARKERS.includes(host)) return true;
    if (host.endsWith('.local')) return true;
    return false;
  } catch {
    return LOCAL_HOST_MARKERS.some((marker) => lower.includes(marker));
  }
};

export const looksLikeProductionDatabaseUrl = (databaseUrl: string | undefined): boolean => {
  if (!databaseUrl) return true;
  const lower = databaseUrl.toLowerCase();
  if (PROD_URL_MARKERS.some((marker) => lower.includes(marker))) return true;
  return !isLocalDatabaseUrl(databaseUrl);
};

export const assertDemoSeedAllowed = (env: DemoSeedEnv = process.env): void => {
  if (env.NODE_ENV !== 'development') {
    throw new Error(
      'Demo seed blocked: NODE_ENV must be development. It deletes users/clients/entries.'
    );
  }
  if (env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      'Demo seed blocked: set ALLOW_DEMO_SEED=true. It deletes users/clients/entries.'
    );
  }
  if (env.CONFIRM_DEMO_SEED_DELETE !== DEMO_SEED_CONFIRM_VALUE) {
    throw new Error(
      `Demo seed blocked: set CONFIRM_DEMO_SEED_DELETE=${DEMO_SEED_CONFIRM_VALUE} (double opt-in). Irreversible delete.`
    );
  }
  if (looksLikeProductionDatabaseUrl(env.DATABASE_URL)) {
    throw new Error(
      'Demo seed blocked: DATABASE_URL does not look like a local/dev database. Refusing destructive seed.'
    );
  }
};
