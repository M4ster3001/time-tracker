import { describe, expect, it } from 'vitest';
import { filterSearchableOptions, normalizeSearchText } from './searchableSelect.filter';

describe('searchableSelect', () => {
  it('normalizes case and accents', () => {
    expect(normalizeSearchText('  Ação Única  ')).toBe('acao unica');
  });

  it('filters options ignoring case and accents', () => {
    const options = [
      { label: 'Trabalha fácil', value: 1 },
      { label: 'Martins', value: 2 },
      { label: 'Empresa B', value: 3 },
    ];

    expect(filterSearchableOptions(options, 'facil')).toEqual([options[0]]);
    expect(filterSearchableOptions(options, 'MARTINS')).toEqual([options[1]]);
    expect(filterSearchableOptions(options, 'empresa b')).toEqual([options[2]]);
  });
});
