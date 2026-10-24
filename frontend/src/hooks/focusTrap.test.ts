import { describe, expect, it } from 'vitest';
import { resolveTabWrapTarget } from './focusTrap';

describe('focusTrap resolveTabWrapTarget', () => {
  it('Tab no ultimo (ou fora) envolve para o primeiro', () => {
    expect(
      resolveTabWrapTarget({ focusableCount: 3, activeIndex: 2, shiftKey: false })
    ).toBe('first');
    expect(
      resolveTabWrapTarget({ focusableCount: 3, activeIndex: -1, shiftKey: false })
    ).toBe('first');
  });

  it('Shift+Tab no primeiro envolve para o ultimo', () => {
    expect(
      resolveTabWrapTarget({ focusableCount: 3, activeIndex: 0, shiftKey: true })
    ).toBe('last');
  });

  it('Tab no meio nao interrompe', () => {
    expect(
      resolveTabWrapTarget({ focusableCount: 3, activeIndex: 1, shiftKey: false })
    ).toBe('none');
    expect(
      resolveTabWrapTarget({ focusableCount: 3, activeIndex: 1, shiftKey: true })
    ).toBe('none');
  });

  it('lista vazia ainda engole Tab (evita fuga)', () => {
    expect(
      resolveTabWrapTarget({ focusableCount: 0, activeIndex: -1, shiftKey: false })
    ).toBe('first');
  });
});
