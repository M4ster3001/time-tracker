import { describe, expect, it } from 'vitest';
import {
  assertDurationWriteInvariants,
  closingEligibleMinutes,
  durationLabels,
  toDurationContract,
  type DurationFields,
} from './duration-contract.js';

const base = (overrides: Partial<DurationFields> = {}): DurationFields => ({
  durationMinutes: 90,
  estimatedDurationMinutes: null,
  confirmedDurationMinutes: null,
  actualTrackedDurationMinutes: null,
  ...overrides,
});

describe('DAT-01 duration contract', () => {
  it('classifica registro legado como declarado, nao medido nem confirmado', () => {
    const contract = toDurationContract(base({ durationMinutes: 135 }));

    expect(contract.classification).toBe('LEGACY_DECLARED');
    expect(contract.legacyDeclaredMinutes).toBe(135);
    expect(contract.estimatedMinutes).toBeNull();
    expect(contract.confirmedMinutes).toBeNull();
    expect(contract.actualTrackedMinutes).toBeNull();
    expect(contract.actualTrackedStatus).toBe('NOT_TRACKED');
    expect(contract.closingEligibleMinutes).toBe(135);
  });

  it('preserva estimativa ao confirmar outra quantidade', () => {
    const contract = toDurationContract(
      base({
        durationMinutes: 135,
        estimatedDurationMinutes: 150,
        confirmedDurationMinutes: 135,
      })
    );

    expect(contract.classification).toBe('STRUCTURED');
    expect(contract.estimatedMinutes).toBe(150);
    expect(contract.confirmedMinutes).toBe(135);
    expect(contract.legacyDeclaredMinutes).toBeNull();
    expect(contract.closingEligibleMinutes).toBe(135);
  });

  it('trata zero medido como medicao valida e distinto de nao medido', () => {
    const trackedZero = toDurationContract(base({ actualTrackedDurationMinutes: 0 }));
    const notTracked = toDurationContract(base());

    expect(trackedZero.actualTrackedMinutes).toBe(0);
    expect(trackedZero.actualTrackedStatus).toBe('TRACKED_ZERO');
    expect(notTracked.actualTrackedStatus).toBe('NOT_TRACKED');
  });

  it('nao usa estimativa nem medicao sozinhas no elegivel de fechamento', () => {
    expect(
      closingEligibleMinutes(
        base({
          durationMinutes: 60,
          estimatedDurationMinutes: 200,
          actualTrackedDurationMinutes: 180,
          confirmedDurationMinutes: null,
        })
      )
    ).toBe(60);

    expect(
      closingEligibleMinutes(
        base({
          durationMinutes: 60,
          estimatedDurationMinutes: 200,
          confirmedDurationMinutes: 90,
          actualTrackedDurationMinutes: 180,
        })
      )
    ).toBe(90);
  });

  it('rejeita escrita que inventa medicao a partir de campos proibidos', () => {
    expect(() =>
      assertDurationWriteInvariants({
        actualTrackedDurationMinutes: 45,
        deriveActualFrom: 'CALENDAR',
      })
    ).toThrow(/ACTUAL_TRACKED_DERIVATION_FORBIDDEN/);

    expect(() =>
      assertDurationWriteInvariants({
        actualTrackedDurationMinutes: 45,
        deriveActualFrom: 'COMMIT',
      })
    ).toThrow(/ACTUAL_TRACKED_DERIVATION_FORBIDDEN/);
  });

  it('permite medicao explicita sem derivacao automatica', () => {
    expect(() =>
      assertDurationWriteInvariants({
        actualTrackedDurationMinutes: 45,
        deriveActualFrom: null,
      })
    ).not.toThrow();
  });

  it('expoe rotulos PT-BR e EN estaveis para as tres duracoes', () => {
    expect(durationLabels.estimated.pt).toBe('Duração estimada');
    expect(durationLabels.estimated.en).toBe('Estimated Duration');
    expect(durationLabels.confirmed.pt).toBe('Duração confirmada');
    expect(durationLabels.confirmed.en).toBe('Confirmed Duration');
    expect(durationLabels.actualTracked.pt).toBe('Duração medida');
    expect(durationLabels.actualTracked.en).toBe('Actual Tracked Duration');
    expect(durationLabels.notTracked.pt).toBe('Não medido');
    expect(durationLabels.notTracked.en).toBe('Not tracked');
  });
});
