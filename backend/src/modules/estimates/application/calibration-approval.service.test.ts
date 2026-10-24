import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flows: vi.fn(),
  proposalFind: vi.fn(),
  taskTypeFind: vi.fn(),
  setFind: vi.fn(),
  setFindMany: vi.fn(),
  revisionFind: vi.fn(),
  revisionUpdate: vi.fn(),
  revisionCreate: vi.fn(),
  proposalUpdate: vi.fn(),
  policyFind: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    calibrationProposal: { findUnique: mocks.proposalFind, update: mocks.proposalUpdate },
    calibrationPolicy: { findUnique: mocks.policyFind },
    taskType: { findUnique: mocks.taskTypeFind },
    estimationParameterSet: {
      findFirst: mocks.setFind,
      findMany: mocks.setFindMany,
    },
    estimationParameterRevision: {
      findFirst: mocks.revisionFind,
      update: mocks.revisionUpdate,
      create: mocks.revisionCreate,
    },
    auditLog: { create: mocks.audit },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../../access-control/application/access-control.service.js', () => ({
  getFlows: mocks.flows,
}));

import { approveOrRejectCalibrationProposal } from './calibration-approval.service.js';

describe('approveOrRejectCalibrationProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flows.mockResolvedValue({ estimates: true });
    mocks.policyFind.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        estimationParameterRevision: {
          update: mocks.revisionUpdate,
          create: mocks.revisionCreate,
        },
        calibrationProposal: { update: mocks.proposalUpdate },
        auditLog: { create: mocks.audit },
      })
    );
  });

  it('aprova e cria EstimationParameterRevision com auditoria', async () => {
    mocks.proposalFind.mockResolvedValue({
      id: 7,
      state: 'PROPOSED',
      proposedBaseMinutes: 110,
      proposedFactor: 1.2,
      parameterSetId: 3,
      taskTypeCode: 'IMPL',
      justification: 'viés',
      sampleSize: 10,
      medianAbsErrorMinutes: 8,
      biasMinutes: 1,
      measuredSampleSize: 4,
    });
    mocks.revisionFind.mockResolvedValue({
      id: 5,
      baseMinutes: 120,
      factor: 1.25,
      roundingMode: 'NEAREST_MINUTE',
    });
    mocks.revisionCreate.mockResolvedValue({ id: 88 });
    mocks.proposalUpdate.mockResolvedValue({ id: 7, state: 'APPROVED' });
    mocks.audit.mockResolvedValue({});

    const result = await approveOrRejectCalibrationProposal({
      proposalId: 7,
      actorUserId: 1,
      decision: 'APPROVE',
      justification: 'viés',
      effectiveFrom: new Date('2026-11-01'),
    });

    expect(result.resultingRevisionId).toBe(88);
    expect(mocks.revisionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } })
    );
    expect(mocks.revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parameterSetId: 3,
          baseMinutes: 110,
          previousRevisionId: 5,
        }),
      })
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'CALIBRATION_APPROVE' }),
      })
    );
  });

  it('rejeita sem criar revisao', async () => {
    mocks.proposalFind.mockResolvedValue({
      id: 7,
      state: 'PROPOSED',
      proposedBaseMinutes: 110,
      proposedFactor: 1.2,
      parameterSetId: 3,
      taskTypeCode: null,
      justification: null,
      sampleSize: 10,
      medianAbsErrorMinutes: 8,
      biasMinutes: 1,
      measuredSampleSize: 4,
    });
    mocks.revisionFind.mockResolvedValue({
      id: 5,
      baseMinutes: 120,
      factor: 1.25,
      roundingMode: 'NEAREST_MINUTE',
    });
    mocks.proposalUpdate.mockResolvedValue({ id: 7, state: 'REJECTED' });

    const result = await approveOrRejectCalibrationProposal({
      proposalId: 7,
      actorUserId: 1,
      decision: 'REJECT',
    });

    expect(result.resultingRevisionId).toBeNull();
    expect(mocks.revisionCreate).not.toHaveBeenCalled();
  });

  it('APPROVE bloqueia quando limiar configurado nao e atendido', async () => {
    mocks.policyFind.mockResolvedValue({
      id: 1,
      minSampleSize: 50,
      minMeasuredSampleSize: null,
      maxMedianAbsoluteErrorMinutes: null,
      maxAbsoluteBiasMinutes: null,
    });
    mocks.proposalFind.mockResolvedValue({
      id: 7,
      state: 'PROPOSED',
      proposedBaseMinutes: 110,
      proposedFactor: 1.2,
      parameterSetId: 3,
      taskTypeCode: 'IMPL',
      justification: null,
      sampleSize: 10,
      medianAbsErrorMinutes: 8,
      biasMinutes: 1,
      measuredSampleSize: 4,
    });

    await expect(
      approveOrRejectCalibrationProposal({
        proposalId: 7,
        actorUserId: 1,
        decision: 'APPROVE',
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('CALIBRATION_THRESHOLDS_NOT_MET'),
    });
    expect(mocks.revisionCreate).not.toHaveBeenCalled();
  });

  it('APPROVE sem parameterSetId escolhe CLIENT por precedência (não GLOBAL cego)', async () => {
    mocks.proposalFind.mockResolvedValue({
      id: 7,
      state: 'PROPOSED',
      proposedBaseMinutes: 100,
      proposedFactor: 1.1,
      parameterSetId: null,
      taskTypeCode: 'IMPL',
      targetClientId: 10,
      targetProjectId: null,
      justification: 'scoped',
      sampleSize: 12,
      medianAbsErrorMinutes: 5,
      biasMinutes: 0,
      measuredSampleSize: 6,
    });
    mocks.taskTypeFind.mockResolvedValue({ id: 42, code: 'IMPL' });
    mocks.setFindMany.mockResolvedValue([
      { id: 1, scope: 'GLOBAL', clientId: null, projectId: null, isActive: true },
      { id: 2, scope: 'CLIENT', clientId: 10, projectId: null, isActive: true },
      { id: 3, scope: 'PROJECT', clientId: 10, projectId: 20, isActive: true },
    ]);
    mocks.revisionFind.mockResolvedValue({
      id: 5,
      baseMinutes: 120,
      factor: 1.25,
      roundingMode: 'NEAREST_MINUTE',
    });
    mocks.revisionCreate.mockResolvedValue({ id: 91 });
    mocks.proposalUpdate.mockResolvedValue({ id: 7, state: 'APPROVED' });
    mocks.audit.mockResolvedValue({});

    const result = await approveOrRejectCalibrationProposal({
      proposalId: 7,
      actorUserId: 1,
      decision: 'APPROVE',
    });

    expect(result.resultingRevisionId).toBe(91);
    expect(mocks.setFind).not.toHaveBeenCalled();
    expect(mocks.setFindMany).toHaveBeenCalled();
    expect(mocks.revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parameterSetId: 2 }),
      })
    );
  });

  it('APPROVE sem parameterSetId escolhe PROJECT quando targetProjectId casa', async () => {
    mocks.proposalFind.mockResolvedValue({
      id: 8,
      state: 'PROPOSED',
      proposedBaseMinutes: 90,
      proposedFactor: 1.05,
      parameterSetId: null,
      taskTypeCode: 'IMPL',
      targetClientId: 10,
      targetProjectId: 20,
      justification: null,
      sampleSize: 8,
      medianAbsErrorMinutes: 4,
      biasMinutes: 1,
      measuredSampleSize: 3,
    });
    mocks.taskTypeFind.mockResolvedValue({ id: 42, code: 'IMPL' });
    mocks.setFindMany.mockResolvedValue([
      { id: 1, scope: 'GLOBAL', clientId: null, projectId: null, isActive: true },
      { id: 2, scope: 'CLIENT', clientId: 10, projectId: null, isActive: true },
      { id: 3, scope: 'PROJECT', clientId: 10, projectId: 20, isActive: true },
    ]);
    mocks.revisionFind.mockResolvedValue(null);
    mocks.revisionCreate.mockResolvedValue({ id: 92 });
    mocks.proposalUpdate.mockResolvedValue({ id: 8, state: 'APPROVED' });
    mocks.audit.mockResolvedValue({});

    await approveOrRejectCalibrationProposal({
      proposalId: 8,
      actorUserId: 1,
      decision: 'APPROVE',
    });

    expect(mocks.revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parameterSetId: 3 }),
      })
    );
  });
});
