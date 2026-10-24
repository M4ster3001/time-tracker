import { describe, expect, it } from 'vitest';
import {
  buildGlobalSearchItems,
  filterGlobalSearchItems,
} from './globalSearch.catalog';

describe('globalSearch.catalog', () => {
  const base = {
    locale: 'pt-BR' as const,
    navigation: [
      {
        path: '/time-entries/new',
        label: 'Novo lançamento',
        labelEn: 'New time entry',
        section: 'hours',
      },
      {
        path: '/closing',
        label: 'Fechamento',
        labelEn: 'Closing',
        section: 'closing',
      },
      {
        path: '/settings',
        label: 'Configurações',
        labelEn: 'Settings',
        section: 'settings',
      },
    ],
    flows: { projects: true, tracking: false, mcp: false },
    canVisit: (path: string) =>
      ['/time-entries/new', '/closing', '/settings', '/clients', '/balances'].includes(path),
    can: (permission: string) =>
      permission === 'projects.read' || permission === 'time.write',
  };

  it('inclui navegação permitida e ações-chave', () => {
    const items = buildGlobalSearchItems(base);
    expect(items.some((item) => item.id === 'nav:/closing')).toBe(true);
    expect(items.some((item) => item.id === 'action:new-entry')).toBe(true);
    expect(items.some((item) => item.id === 'action:projects')).toBe(true);
    expect(items.some((item) => item.id === 'action:help')).toBe(true);
    expect(items.some((item) => item.kind === 'help' && item.helpId === 'log-hours')).toBe(
      true
    );
  });

  it('omite ações sem permissão ou fluxo', () => {
    const items = buildGlobalSearchItems({
      ...base,
      flows: { projects: false },
      can: () => false,
      canVisit: (path) => path === '/settings',
    });
    expect(items.some((item) => item.id === 'action:projects')).toBe(false);
    expect(items.some((item) => item.id === 'action:new-entry')).toBe(false);
    expect(items.some((item) => item.id === 'action:calibration')).toBe(false);
    expect(items.some((item) => item.helpId === 'tracking')).toBe(false);
  });

  it('filtra por texto normalizado', () => {
    const items = buildGlobalSearchItems(base);
    const filtered = filterGlobalSearchItems(items, 'LANÇAR');
    expect(filtered.some((item) => item.helpId === 'log-hours' || item.id.includes('entry'))).toBe(
      true
    );
    expect(filterGlobalSearchItems(items, 'zzzz-inexistente')).toHaveLength(0);
  });
});
