import type { KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { onTablistKeyDown } from './tablistKeyboard';

const keyEvent = (key: string) =>
  ({
    key,
    preventDefault: vi.fn(),
  }) as unknown as KeyboardEvent;

describe('onTablistKeyDown', () => {
  it('moves right and wraps', () => {
    const selectIndex = vi.fn();
    onTablistKeyDown(keyEvent('ArrowRight'), {
      selectedIndex: 2,
      length: 3,
      selectIndex,
    });
    expect(selectIndex).toHaveBeenCalledWith(0);
  });

  it('jumps to Home and End', () => {
    const selectIndex = vi.fn();
    onTablistKeyDown(keyEvent('Home'), {
      selectedIndex: 1,
      length: 4,
      selectIndex,
    });
    expect(selectIndex).toHaveBeenCalledWith(0);
    onTablistKeyDown(keyEvent('End'), {
      selectedIndex: 1,
      length: 4,
      selectIndex,
    });
    expect(selectIndex).toHaveBeenCalledWith(3);
  });
});
