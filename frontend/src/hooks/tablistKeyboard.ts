import type { KeyboardEvent } from 'react';

/** Arrow / Home / End navigation for a role="tablist" (WCAG APG tabs pattern). */
export const onTablistKeyDown = (
  event: KeyboardEvent,
  opts: {
    selectedIndex: number;
    length: number;
    selectIndex: (index: number) => void;
  }
): void => {
  const { selectedIndex, length, selectIndex } = opts;
  if (length <= 0) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    selectIndex((selectedIndex + delta + length) % length);
  } else if (event.key === 'Home') {
    event.preventDefault();
    selectIndex(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    selectIndex(length - 1);
  }
};
