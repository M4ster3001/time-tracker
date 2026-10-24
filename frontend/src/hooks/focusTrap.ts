/**
 * Trap Tab/Shift+Tab inside a container (modal overlays).
 * Pure wrap rule is tested without DOM; DOM helpers are thin adapters.
 */

export type TabWrapTarget = 'first' | 'last' | 'none';

/** Pure: when Tab should wrap inside a focusable list. */
export const resolveTabWrapTarget = (input: {
  focusableCount: number;
  activeIndex: number;
  shiftKey: boolean;
}): TabWrapTarget => {
  if (input.focusableCount <= 0) return 'first';
  const outside = input.activeIndex < 0;
  if (input.shiftKey) {
    return outside || input.activeIndex <= 0 ? 'last' : 'none';
  }
  return outside || input.activeIndex >= input.focusableCount - 1 ? 'first' : 'none';
};

export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const nodes = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return [...nodes].filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
  );
};

export const trapFocusKeyDown = (
  container: HTMLElement,
  event: KeyboardEvent | { key: string; shiftKey: boolean; preventDefault: () => void }
): boolean => {
  if (event.key !== 'Tab') return false;
  const focusable = getFocusableElements(container);
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  const activeIndex =
    active instanceof HTMLElement ? focusable.indexOf(active) : -1;
  const target = resolveTabWrapTarget({
    focusableCount: focusable.length,
    activeIndex: activeIndex < 0 ? (event.shiftKey ? 0 : focusable.length - 1) : activeIndex,
    shiftKey: event.shiftKey,
  });
  if (target === 'none') return false;
  event.preventDefault();
  if (focusable.length === 0) return true;
  if (target === 'first') focusable[0]?.focus();
  else focusable[focusable.length - 1]?.focus();
  return true;
};
