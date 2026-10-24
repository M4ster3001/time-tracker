/** Pure helpers for SearchableSelect listbox keyboard navigation (APG-style). */

export const clampActiveIndex = (index: number, length: number): number => {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
};

export const nextActiveIndex = (
  current: number,
  length: number,
  direction: 'down' | 'up' | 'home' | 'end'
): number => {
  if (length <= 0) return 0;
  if (direction === 'home') return 0;
  if (direction === 'end') return length - 1;
  if (direction === 'down') return clampActiveIndex(current + 1, length);
  return clampActiveIndex(current - 1, length);
};
