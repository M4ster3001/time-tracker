import { describe, expect, it } from 'vitest';
import {
  clientRequiresProject,
  isBulkRowProjectValid,
  projectSelectOptionsForBulk,
} from './bulkTimeEntryProject';

describe('PRJ-01 bulk project helpers', () => {
  const clients = [
    { id: 1, name: 'Acme', requireProjectOnEntries: true },
    { id: 2, name: 'Beta', requireProjectOnEntries: false },
  ];

  it('exige projeto só com flow ligado e flag do cliente', () => {
    expect(clientRequiresProject(clients, 1, true)).toBe(true);
    expect(clientRequiresProject(clients, 1, false)).toBe(false);
    expect(clientRequiresProject(clients, 2, true)).toBe(false);
    expect(clientRequiresProject(clients, 0, true)).toBe(false);
  });

  it('bloqueia Sem projeto quando requireProject', () => {
    expect(
      isBulkRowProjectValid({ projectsEnabled: true, requireProject: true, projectId: null })
    ).toBe(false);
    expect(
      isBulkRowProjectValid({ projectsEnabled: true, requireProject: true, projectId: 0 })
    ).toBe(false);
    expect(
      isBulkRowProjectValid({ projectsEnabled: true, requireProject: true, projectId: 9 })
    ).toBe(true);
    expect(
      isBulkRowProjectValid({ projectsEnabled: true, requireProject: false, projectId: null })
    ).toBe(true);
  });

  it('omite Sem projeto nas opções quando obrigatório', () => {
    const projects = [
      { id: 3, code: 'A', name: 'Alpha', state: 'ACTIVE', clientId: 1 },
      { id: 4, code: 'B', name: 'Arch', state: 'ARCHIVED', clientId: 1 },
    ];
    const required = projectSelectOptionsForBulk({
      projects,
      requireProject: true,
      locale: 'pt',
    });
    expect(required.map((o) => o.value)).toEqual([3]);
    expect(required.some((o) => o.label === 'Sem projeto')).toBe(false);

    const optional = projectSelectOptionsForBulk({
      projects,
      requireProject: false,
      locale: 'pt',
    });
    expect(optional[0]).toEqual({ value: 0, label: 'Sem projeto' });
  });
});
