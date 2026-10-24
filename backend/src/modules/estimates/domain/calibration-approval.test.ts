import { describe, expect, it } from 'vitest';
import { decideCalibrationProposal } from './calibration-approval.js';

describe('CAL-01 calibration approval', () => {
  const current = {
    id: 5,
    baseMinutes: 120,
    factor: 1.25,
    roundingMode: 'NEAREST_MINUTE',
  };

  it('aprova PROPOSED e monta nova EstimationParameterRevision permanente', () => {
    const result = decideCalibrationProposal({
      proposalState: 'PROPOSED',
      proposedBaseMinutes: 110,
      proposedFactor: 1.2,
      currentRevision: current,
      effectiveFrom: new Date('2026-11-01T00:00:00.000Z'),
      decision: 'APPROVE',
      actorUserId: 1,
      justification: 'viés consistente na amostra',
    });

    expect(result.nextState).toBe('APPROVED');
    expect(result.parameterRevision).toMatchObject({
      baseMinutes: 110,
      factor: 1.2,
      previousRevisionId: 5,
      authorUserId: 1,
      reason: 'viés consistente na amostra',
    });
    expect(result.parameterRevision?.effectiveFrom.toISOString()).toBe(
      '2026-11-01T00:00:00.000Z'
    );
    expect(result.closesPreviousRevision).toBe(true);
  });

  it('rejeita proposta sem criar revisao de catalogo', () => {
    const result = decideCalibrationProposal({
      proposalState: 'PROPOSED',
      proposedBaseMinutes: 110,
      proposedFactor: 1.2,
      currentRevision: current,
      effectiveFrom: new Date('2026-11-01T00:00:00.000Z'),
      decision: 'REJECT',
      actorUserId: 1,
      justification: 'amostra insuficiente',
    });
    expect(result.nextState).toBe('REJECTED');
    expect(result.parameterRevision).toBeNull();
    expect(result.closesPreviousRevision).toBe(false);
  });

  it('nao permite aprovar ja decidida nem valores invalidos', () => {
    expect(() =>
      decideCalibrationProposal({
        proposalState: 'APPROVED',
        proposedBaseMinutes: 100,
        proposedFactor: 1,
        currentRevision: current,
        effectiveFrom: new Date(),
        decision: 'APPROVE',
        actorUserId: 1,
      })
    ).toThrow(/CALIBRATION_ALREADY_DECIDED/);

    expect(() =>
      decideCalibrationProposal({
        proposalState: 'PROPOSED',
        proposedBaseMinutes: null,
        proposedFactor: 1.2,
        currentRevision: current,
        effectiveFrom: new Date(),
        decision: 'APPROVE',
        actorUserId: 1,
      })
    ).toThrow(/CALIBRATION_PROPOSAL_INCOMPLETE/);
  });

  it('nao altera revisoes passadas: nova revisao aponta previousRevisionId', () => {
    const result = decideCalibrationProposal({
      proposalState: 'DRAFT',
      proposedBaseMinutes: 90,
      proposedFactor: 1.0,
      currentRevision: current,
      effectiveFrom: new Date('2026-12-01'),
      decision: 'APPROVE',
      actorUserId: 2,
      justification: 'piloto',
    });
    expect(result.parameterRevision?.previousRevisionId).toBe(5);
    expect(result.parameterRevision?.baseMinutes).not.toBe(current.baseMinutes);
  });
});
