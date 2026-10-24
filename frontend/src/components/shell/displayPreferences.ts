/**
 * Preferencias de apresentacao (PLANO §7.1 densidade + §8 contraste).
 * Persistidas localmente; nao inventam certificacao AA.
 */

export type DisplayDensity = 'comfortable' | 'compact';

export type DisplayPreferences = {
  density: DisplayDensity;
  highContrast: boolean;
};

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  density: 'comfortable',
  highContrast: false,
};

const STORAGE_KEY = 'tt.displayPreferences';

const getLocalStorage = (): Storage | null => {
  try {
    if (typeof globalThis === 'undefined') return null;
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
};

export const parseDisplayPreferences = (raw: unknown): DisplayPreferences => {
  if (raw == null || typeof raw !== 'object') {
    return { ...DEFAULT_DISPLAY_PREFERENCES };
  }
  const row = raw as Record<string, unknown>;
  const density =
    row.density === 'compact' || row.density === 'comfortable'
      ? row.density
      : DEFAULT_DISPLAY_PREFERENCES.density;
  const highContrast =
    typeof row.highContrast === 'boolean'
      ? row.highContrast
      : DEFAULT_DISPLAY_PREFERENCES.highContrast;
  return { density, highContrast };
};

export const mergeDisplayPreferences = (
  defaults: DisplayPreferences,
  patch: Partial<DisplayPreferences> | null | undefined
): DisplayPreferences => {
  if (!patch) return { ...defaults };
  return parseDisplayPreferences({ ...defaults, ...patch });
};

export const readDisplayPreferences = (): DisplayPreferences => {
  try {
    const raw = getLocalStorage()?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DISPLAY_PREFERENCES };
    return parseDisplayPreferences(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_DISPLAY_PREFERENCES };
  }
};

export const writeDisplayPreferences = (prefs: DisplayPreferences): void => {
  try {
    getLocalStorage()?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode */
  }
};

export const applyDisplayPreferencesToDocument = (
  prefs: DisplayPreferences,
  root: HTMLElement = document.documentElement
): void => {
  root.setAttribute('data-density', prefs.density);
  if (prefs.highContrast) {
    root.setAttribute('data-contrast', 'high');
  } else {
    root.removeAttribute('data-contrast');
  }
};
