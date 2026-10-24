import { describe, expect, it } from 'vitest';
import {
  assertProjectBelongsToClient,
  assertProjectCode,
  assertProjectTransition,
  normalizeProjectCode,
  type ProjectState,
} from './project.rules.js';

describe('PRJ-01 project rules', () => {
  it('normaliza codigo e rejeita vazio', () => {
    expect(normalizeProjectCode('  abc-1  ')).toBe('ABC-1');
    expect(() => assertProjectCode('')).toThrow(/PROJECT_CODE_REQUIRED/);
    expect(() => assertProjectCode('   ')).toThrow(/PROJECT_CODE_REQUIRED/);
  });

  it('permite mesmo codigo em clientes diferentes e rejeita vinculo cruzado', () => {
    expect(() =>
      assertProjectBelongsToClient({ projectClientId: 1, requestedClientId: 1 })
    ).not.toThrow();
    expect(() =>
      assertProjectBelongsToClient({ projectClientId: 1, requestedClientId: 2 })
    ).toThrow(/PROJECT_CLIENT_MISMATCH/);
  });

  it('bloqueia novos lancamentos em estados nao ativos', () => {
    const active: ProjectState = 'ACTIVE';
    const archived: ProjectState = 'ARCHIVED';
    expect(assertProjectTransition(active, 'canCreateTimeEntry')).toBe(true);
    expect(assertProjectTransition('PLANNED', 'canCreateTimeEntry')).toBe(true);
    expect(assertProjectTransition('PAUSED', 'canCreateTimeEntry')).toBe(false);
    expect(assertProjectTransition(archived, 'canCreateTimeEntry')).toBe(false);
    expect(assertProjectTransition('COMPLETED', 'canCreateTimeEntry')).toBe(false);
  });
});
