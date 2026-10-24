import { describe, expect, it } from 'vitest';
import {
  labelsMatchInsensitive,
  presentNavGroups,
  type NavGroupInput,
} from './navGroups';

const group = (
  partial: Partial<NavGroupInput> & Pick<NavGroupInput, 'key' | 'label' | 'items'>
): NavGroupInput => ({
  mark: partial.mark ?? 'X',
  defaultOpen: partial.defaultOpen ?? true,
  ...partial,
});

describe('navGroups workspace layout IA', () => {
  it('matches labels case-insensitively and accent-insensitively', () => {
    expect(labelsMatchInsensitive('CONFIGURAÇÕES', 'Configurações')).toBe(true);
    expect(labelsMatchInsensitive('Relatórios', 'RELATORIOS')).toBe(true);
    expect(labelsMatchInsensitive('Reports', 'reports')).toBe(true);
    expect(labelsMatchInsensitive('Configurações', 'Preferências')).toBe(false);
  });

  it('promotes a singleton whose label matches the group to a flat top-level link', () => {
    const presented = presentNavGroups([
      group({
        key: 'settings',
        label: 'Configurações',
        items: [{ to: '/settings', label: 'Configurações' }],
      }),
      group({
        key: 'reports',
        label: 'Relatórios',
        items: [{ to: '/reports', label: 'RELATÓRIOS' }],
      }),
    ]);

    expect(presented).toEqual([
      {
        kind: 'link',
        key: 'settings',
        mark: 'X',
        item: { to: '/settings', label: 'Configurações' },
      },
      {
        kind: 'link',
        key: 'reports',
        mark: 'X',
        item: { to: '/reports', label: 'RELATÓRIOS' },
      },
    ]);
  });

  it('keeps collapsible groups when the singleton label differs or there are siblings', () => {
    const settingsWithPrefs = group({
      key: 'settings',
      label: 'Configurações',
      items: [{ to: '/settings', label: 'Preferências' }],
    });
    const hours = group({
      key: 'hours',
      label: 'Horas',
      mark: 'Hr',
      items: [
        { to: '/time-entries/new', label: 'Lançar horas' },
        { to: '/time-entries', label: 'Meus lançamentos' },
      ],
    });

    expect(presentNavGroups([settingsWithPrefs, hours])).toEqual([
      { kind: 'group', group: settingsWithPrefs },
      { kind: 'group', group: hours },
    ]);
  });
});
