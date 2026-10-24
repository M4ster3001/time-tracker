import { describe, expect, it } from 'vitest';
import {
  applyDisplayPreferencesToDocument,
  mergeDisplayPreferences,
  parseDisplayPreferences,
  type DisplayPreferences,
} from './displayPreferences';

describe('displayPreferences (UX §7.1 / §8)', () => {
  it('defaults confortavel sem alto contraste', () => {
    expect(parseDisplayPreferences(null)).toEqual({
      density: 'comfortable',
      highContrast: false,
    });
    expect(parseDisplayPreferences({})).toEqual({
      density: 'comfortable',
      highContrast: false,
    });
  });

  it('aceita density compact e highContrast; ignora lixo', () => {
    expect(
      parseDisplayPreferences({ density: 'compact', highContrast: true, ghost: 1 })
    ).toEqual({ density: 'compact', highContrast: true });
    expect(parseDisplayPreferences({ density: 'ultra', highContrast: 'yes' })).toEqual({
      density: 'comfortable',
      highContrast: false,
    });
  });

  it('merge preserva defaults para chaves ausentes', () => {
    const defaults: DisplayPreferences = { density: 'comfortable', highContrast: false };
    expect(mergeDisplayPreferences(defaults, { density: 'compact' })).toEqual({
      density: 'compact',
      highContrast: false,
    });
  });

  it('aplica data-density e data-contrast no documentElement', () => {
    const attrs = new Map<string, string>();
    const root = {
      setAttribute: (key: string, value: string) => {
        attrs.set(key, value);
      },
      removeAttribute: (key: string) => {
        attrs.delete(key);
      },
      getAttribute: (key: string) => attrs.get(key) ?? null,
      hasAttribute: (key: string) => attrs.has(key),
    } as unknown as HTMLElement;

    applyDisplayPreferencesToDocument(
      { density: 'compact', highContrast: true },
      root
    );
    expect(root.getAttribute('data-density')).toBe('compact');
    expect(root.getAttribute('data-contrast')).toBe('high');
    applyDisplayPreferencesToDocument(
      { density: 'comfortable', highContrast: false },
      root
    );
    expect(root.getAttribute('data-density')).toBe('comfortable');
    expect(root.hasAttribute('data-contrast')).toBe(false);
  });
});
