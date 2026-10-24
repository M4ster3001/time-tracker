export type ShellLayoutVariant = 'a' | 'b' | 'c';

export const LAYOUT_STORAGE_KEY = 'tt-shell-layout';
/** Default workspace layout; the other variants remain available to users. */
export const DEFAULT_LAYOUT: ShellLayoutVariant = 'b';

export const LAYOUT_LABELS: Record<ShellLayoutVariant, string> = {
  a: 'A — Top navigation',
  b: 'B — Workspace',
  c: 'C — Dark sidebar',
};

export function isShellLayoutVariant(value: string | null | undefined): value is ShellLayoutVariant {
  return value === 'a' || value === 'b' || value === 'c';
}

export function readShellLayout(): ShellLayoutVariant {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (isShellLayoutVariant(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYOUT;
}

export function writeShellLayout(layout: ShellLayoutVariant): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  } catch {
    /* ignore */
  }
  applyShellLayoutToDocument(layout);
}

export function applyShellLayoutToDocument(layout: ShellLayoutVariant): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.layout = layout;
}
