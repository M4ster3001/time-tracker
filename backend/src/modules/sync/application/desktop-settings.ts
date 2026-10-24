import fs from 'fs';
import path from 'path';
import { config } from '../../../config.js';

/**
 * Configuracao persistente do runtime desktop (URL do remoto, sessao remota,
 * cursor de sync e pasta de backup). Guardada como JSON no diretorio de dados
 * do desktop -- nao vai para o banco para nao ser sobrescrita pela sincronizacao.
 */
export interface DesktopSettings {
  remoteUrl: string | null;
  remoteRefreshToken: string | null;
  remoteUserUuid: string | null;
  syncCursor: string | null;
  pushCursor: string | null;
  backupDir: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'ok' | 'offline' | 'error';
  lastSyncError: string | null;
}

const DEFAULTS: DesktopSettings = {
  remoteUrl: null,
  remoteRefreshToken: null,
  remoteUserUuid: null,
  syncCursor: null,
  pushCursor: null,
  backupDir: null,
  lastSyncedAt: null,
  lastSyncStatus: 'idle',
  lastSyncError: null,
};

const settingsPath = (): string => {
  const dir = config.desktop.dataDir || process.cwd();
  return path.join(dir, 'desktop-settings.json');
};

let cache: DesktopSettings | null = null;

export const getDesktopSettings = (): DesktopSettings => {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    cache = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DesktopSettings>) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
};

export const updateDesktopSettings = (patch: Partial<DesktopSettings>): DesktopSettings => {
  const next = { ...getDesktopSettings(), ...patch };
  cache = next;
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return next;
};

/** Versao segura para expor ao frontend (sem tokens). */
export const getPublicDesktopSettings = () => {
  const s = getDesktopSettings();
  return {
    remoteUrl: s.remoteUrl,
    connected: Boolean(s.remoteUrl && s.remoteRefreshToken),
    backupDir: s.backupDir,
    lastSyncedAt: s.lastSyncedAt,
    lastSyncStatus: s.lastSyncStatus,
    lastSyncError: s.lastSyncError,
  };
};
