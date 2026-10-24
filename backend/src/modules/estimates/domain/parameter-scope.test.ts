import { describe, expect, it } from 'vitest';
import {
  assertParameterScopeTargets,
  selectParameterSetByPrecedence,
  type ParameterSetCandidate,
} from './parameter-scope.js';

const candidate = (
  partial: Partial<ParameterSetCandidate> & Pick<ParameterSetCandidate, 'id' | 'scope'>
): ParameterSetCandidate => ({
  id: partial.id,
  scope: partial.scope,
  clientId: partial.clientId ?? null,
  projectId: partial.projectId ?? null,
  isActive: partial.isActive ?? true,
  revisionUuid: partial.revisionUuid ?? `rev-${partial.id}`,
  baseMinutes: partial.baseMinutes ?? 60,
  factor: partial.factor ?? 1,
});

describe('EST-01 parameter scope precedence', () => {
  it('escolhe PROJECT sobre CLIENT e GLOBAL sem combinar fatores', () => {
    const picked = selectParameterSetByPrecedence(
      [
        candidate({ id: 1, scope: 'GLOBAL', baseMinutes: 30, factor: 1 }),
        candidate({ id: 2, scope: 'CLIENT', clientId: 10, baseMinutes: 45, factor: 2 }),
        candidate({ id: 3, scope: 'PROJECT', clientId: 10, projectId: 20, baseMinutes: 90, factor: 3 }),
      ],
      { clientId: 10, projectId: 20 }
    );
    expect(picked).toMatchObject({
      id: 3,
      scope: 'PROJECT',
      baseMinutes: 90,
      factor: 3,
    });
  });

  it('cai para CLIENT quando não há set de projeto', () => {
    const picked = selectParameterSetByPrecedence(
      [
        candidate({ id: 1, scope: 'GLOBAL', factor: 1 }),
        candidate({ id: 2, scope: 'CLIENT', clientId: 10, factor: 1.5 }),
        candidate({ id: 9, scope: 'PROJECT', clientId: 10, projectId: 99, factor: 9 }),
      ],
      { clientId: 10, projectId: 20 }
    );
    expect(picked?.id).toBe(2);
    expect(picked?.factor).toBe(1.5);
  });

  it('cai para GLOBAL quando cliente/projeto não batem', () => {
    const picked = selectParameterSetByPrecedence(
      [
        candidate({ id: 1, scope: 'GLOBAL', baseMinutes: 55, factor: 1.2 }),
        candidate({ id: 2, scope: 'CLIENT', clientId: 99, factor: 9 }),
      ],
      { clientId: 10, projectId: null }
    );
    expect(picked).toMatchObject({ id: 1, scope: 'GLOBAL', baseMinutes: 55, factor: 1.2 });
  });

  it('ignora sets inativos', () => {
    const picked = selectParameterSetByPrecedence(
      [
        candidate({ id: 1, scope: 'GLOBAL', isActive: false }),
        candidate({ id: 2, scope: 'GLOBAL', baseMinutes: 40, factor: 1.1 }),
      ],
      { clientId: null, projectId: null }
    );
    expect(picked?.id).toBe(2);
  });

  it('valida alvos de escopo CLIENT e PROJECT', () => {
    expect(() => assertParameterScopeTargets({ scope: 'GLOBAL' })).not.toThrow();
    expect(() =>
      assertParameterScopeTargets({ scope: 'CLIENT', clientId: 1 })
    ).not.toThrow();
    expect(() =>
      assertParameterScopeTargets({ scope: 'PROJECT', clientId: 1, projectId: 2 })
    ).not.toThrow();
    expect(() => assertParameterScopeTargets({ scope: 'CLIENT' })).toThrow(
      /PARAMETER_SCOPE_CLIENT_REQUIRED/
    );
    expect(() =>
      assertParameterScopeTargets({ scope: 'PROJECT', clientId: 1 })
    ).toThrow(/PARAMETER_SCOPE_PROJECT_REQUIRED/);
    expect(() =>
      assertParameterScopeTargets({ scope: 'GLOBAL', clientId: 1 })
    ).toThrow(/PARAMETER_SCOPE_GLOBAL_NO_TARGET/);
  });
});
