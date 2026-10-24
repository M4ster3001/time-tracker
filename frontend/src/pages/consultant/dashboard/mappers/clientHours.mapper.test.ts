import { describe, expect, it } from 'vitest';
import { buildClientHoursView } from './clientHours.mapper';

const client = (clientId: number, clientName: string, workedMinutes: number, overtime = 0) => ({
  clientId,
  clientName,
  workedMinutes,
  overtimeMinutes: overtime,
});

describe('buildClientHoursView', () => {
  it('groups "Parent - Child" clients, sorts by hours and hides empty clients', () => {
    const view = buildClientHoursView([
      client(1, 'Mouvy', 660, 660),
      client(2, 'MRN', 0),
      client(3, 'MRN - Blip', 510, 510),
      client(4, 'MRN - Fluxo de Caixa', 1860, 1860),
      client(5, 'MRN - Radar', 1860, 1860),
      client(6, 'Example Client C', 90, 90),
    ]);

    expect(view.groups.map((group) => group.name)).toEqual(['MRN', 'Mouvy', 'Example Client C']);
    const mrn = view.groups[0];
    expect(mrn.workedMinutes).toBe(510 + 1860 + 1860);
    expect(mrn.rows.map((row) => row.label)).toEqual(['Fluxo de Caixa', 'Radar', 'Blip']);
    expect(view.emptyClients.map((item) => item.clientName)).toEqual(['MRN']);
    expect(view.totalWorkedMinutes).toBe(660 + 4230 + 90);
    expect(view.maxGroupMinutes).toBe(4230);
  });

  it('keeps a lone child with its full name and as a flat row', () => {
    const view = buildClientHoursView([client(1, 'MRN - Blip', 60)]);
    expect(view.groups).toHaveLength(1);
    expect(view.groups[0].name).toBe('MRN - Blip');
    expect(view.groups[0].rows).toHaveLength(1);
  });

  it('puts the parent own hours under a "Geral" row next to its children', () => {
    const view = buildClientHoursView([client(1, 'MRN', 30), client(2, 'MRN - Blip', 60)]);
    expect(view.groups[0].rows.map((row) => row.label)).toEqual(['Blip', 'Geral']);
  });

  it('handles an empty list', () => {
    expect(buildClientHoursView([])).toEqual({
      groups: [],
      emptyClients: [],
      totalWorkedMinutes: 0,
      maxGroupMinutes: 0,
    });
  });
});
