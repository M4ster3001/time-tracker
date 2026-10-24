import os from 'os';
import path from 'path';

export type AppRuntime = 'server' | 'desktop';

const appRuntime = (
  process.env.APP_RUNTIME === 'desktop' || process.env.DESKTOP_MODE === 'true'
    ? 'desktop'
    : 'server'
) as AppRuntime;

export const getAppRuntime = (): AppRuntime => appRuntime;

export const isDesktopRuntime = (): boolean => getAppRuntime() === 'desktop';

export const isServerRuntime = (): boolean => getAppRuntime() === 'server';

export const getDesktopAppName = (): string =>
  process.env.DESKTOP_APP_NAME || 'time-tracker-system';

export const resolveDesktopDataDir = (): string => {
  if (process.env.DESKTOP_DATA_DIR) {
    return path.resolve(process.env.DESKTOP_DATA_DIR);
  }

  return path.join(os.homedir(), '.config', getDesktopAppName());
};

export const resolveDesktopDatabasePath = (): string => {
  return path.join(resolveDesktopDataDir(), 'data', 'time-tracker.db');
};

export const resolveDesktopDatabaseUrl = (): string => {
  const dbPath = resolveDesktopDatabasePath().replace(/\\/g, '/');
  return `file:${dbPath}`;
};

export const isFeatureEnabledInDesktop = (flagName: string, defaultValue = false): boolean => {
  if (!isDesktopRuntime()) {
    return true;
  }

  const raw = process.env[flagName];
  if (raw == null || raw === '') {
    return defaultValue;
  }

  return raw === 'true';
};
