import { describe, expect, it } from 'vitest';
import {
  formatParameterScopeLabel,
  formatParameterSetSummary,
  formatTaskTypeLabel,
  scopeNeedsClient,
  scopeNeedsProject,
  sortTaskTypesForDisplay,
  type TaskTypeAdminRow,
} from './taskTypesUi';

describe('EST-01 task types UI helpers', () => {
  const rows: TaskTypeAdminRow[] = [
    {
      id: 2,
      code: 'TESTS',
      namePt: 'Testes',
      nameEn: 'Tests',
      description: null,
      isActive: true,
      activeBaseMinutes: 45,
      activeFactor: 1.1,
    },
    {
      id: 1,
      code: 'ANALYSIS',
      namePt: 'Análise',
      nameEn: 'Analysis',
      description: null,
      isActive: false,
      activeBaseMinutes: null,
      activeFactor: null,
    },
  ];

  it('ordena ativos primeiro e depois por código', () => {
    expect(sortTaskTypesForDisplay(rows).map((r) => r.code)).toEqual(['TESTS', 'ANALYSIS']);
  });

  it('monta rótulo bilíngue com código', () => {
    expect(formatTaskTypeLabel(rows[0], 'pt')).toBe('TESTS — Testes');
    expect(formatTaskTypeLabel(rows[0], 'en')).toBe('TESTS — Tests');
  });

  it('exige cliente/projeto conforme escopo de parâmetros', () => {
    expect(scopeNeedsClient('GLOBAL')).toBe(false);
    expect(scopeNeedsClient('CLIENT')).toBe(true);
    expect(scopeNeedsProject('CLIENT')).toBe(false);
    expect(scopeNeedsProject('PROJECT')).toBe(true);
    expect(formatParameterScopeLabel('PROJECT', 'pt')).toBe('Projeto');
    expect(
      formatParameterSetSummary(
        {
          id: 1,
          scope: 'CLIENT',
          clientId: 7,
          projectId: null,
          activeBaseMinutes: 60,
          activeFactor: 1.2,
        },
        'pt'
      )
    ).toBe('Cliente #7 · 60 × 1.2');
  });
});
