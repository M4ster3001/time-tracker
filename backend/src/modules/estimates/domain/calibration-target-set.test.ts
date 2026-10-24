import { describe, expect, it } from 'vitest';
import {
  resolveCalibrationTargetParameterSet,
  type CalibrationParameterSetRow,
} from './calibration-target-set.js';

const row = (
  partial: Partial<CalibrationParameterSetRow> &
    Pick<CalibrationParameterSetRow, 'id' | 'scope'>
): CalibrationParameterSetRow => ({
  id: partial.id,
  scope: partial.scope,
  clientId: partial.clientId ?? null,
  projectId: partial.projectId ?? null,
  isActive: partial.isActive ?? true,
});

describe('resolveCalibrationTargetParameterSet', () => {
  const catalog = [
    row({ id: 1, scope: 'GLOBAL' }),
    row({ id: 2, scope: 'CLIENT', clientId: 10 }),
    row({ id: 3, scope: 'PROJECT', clientId: 10, projectId: 20 }),
  ];

  it('honra parameterSetId explícito ativo sem cair no GLOBAL', () => {
    const picked = resolveCalibrationTargetParameterSet({
      explicitParameterSetId: 2,
      candidates: catalog,
      context: {},
    });
    expect(picked).toMatchObject({ id: 2, scope: 'CLIENT' });
  });

  it('rejeita parameterSetId explícito inativo ou ausente', () => {
    expect(
      resolveCalibrationTargetParameterSet({
        explicitParameterSetId: 2,
        candidates: [row({ id: 2, scope: 'CLIENT', clientId: 10, isActive: false })],
      })
    ).toBeNull();
    expect(
      resolveCalibrationTargetParameterSet({
        explicitParameterSetId: 99,
        candidates: catalog,
      })
    ).toBeNull();
  });

  it('escolhe PROJECT sobre CLIENT e GLOBAL quando há contexto', () => {
    const picked = resolveCalibrationTargetParameterSet({
      candidates: catalog,
      context: { clientId: 10, projectId: 20 },
    });
    expect(picked).toMatchObject({ id: 3, scope: 'PROJECT' });
  });

  it('escolhe CLIENT quando não há set de projeto para o contexto', () => {
    const picked = resolveCalibrationTargetParameterSet({
      candidates: catalog,
      context: { clientId: 10, projectId: 99 },
    });
    expect(picked).toMatchObject({ id: 2, scope: 'CLIENT' });
  });

  it('só cai em GLOBAL quando o contexto não casa com CLIENT/PROJECT', () => {
    const picked = resolveCalibrationTargetParameterSet({
      candidates: catalog,
      context: { clientId: 77, projectId: null },
    });
    expect(picked).toMatchObject({ id: 1, scope: 'GLOBAL' });
  });

  it('sem contexto e sem id explícito seleciona GLOBAL ativo', () => {
    const picked = resolveCalibrationTargetParameterSet({
      candidates: catalog,
      context: {},
    });
    expect(picked).toMatchObject({ id: 1, scope: 'GLOBAL' });
  });
});
