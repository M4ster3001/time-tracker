const SIDEBAR_COLLAPSED_KEY = 'tt.sidebarCollapsed';
const NAV_OPEN_GROUPS_KEY = 'tt.navOpenGroups';

const getLocalStorage = (): Storage | null => {
  try {
    if (typeof globalThis === 'undefined') return null;
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
};

export const mergeNavOpenGroups = (
  defaults: Record<string, boolean>,
  stored: Record<string, unknown> | null
): Record<string, boolean> => {
  const next: Record<string, boolean> = { ...defaults };
  if (!stored) return next;
  for (const key of Object.keys(defaults)) {
    if (typeof stored[key] === 'boolean') next[key] = stored[key];
  }
  return next;
};

export const readSidebarCollapsed = (): boolean => {
  try {
    return getLocalStorage()?.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

export const writeSidebarCollapsed = (collapsed: boolean): void => {
  try {
    getLocalStorage()?.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
};

export const readNavOpenGroups = (defaults: Record<string, boolean>): Record<string, boolean> => {
  try {
    const raw = getLocalStorage()?.getItem(NAV_OPEN_GROUPS_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { ...defaults };
    return mergeNavOpenGroups(defaults, parsed as Record<string, unknown>);
  } catch {
    return { ...defaults };
  }
};

export const writeNavOpenGroups = (groups: Record<string, boolean>): void => {
  try {
    getLocalStorage()?.setItem(NAV_OPEN_GROUPS_KEY, JSON.stringify(groups));
  } catch {
    /* ignore quota / private mode */
  }
};
