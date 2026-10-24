import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flows: vi.fn(),
  grants: vi.fn(),
  linkReference: vi.fn(),
  createRevision: vi.fn(),
  auditCreate: vi.fn(),
  workActivityFindUnique: vi.fn(),
  workActivityFindFirst: vi.fn(),
}));

vi.mock('../../access-control/application/access-control.service.js', () => ({
  getFlows: mocks.flows,
  getUserGrants: mocks.grants,
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    auditLog: { create: mocks.auditCreate },
    workActivity: {
      findUnique: mocks.workActivityFindUnique,
      findFirst: mocks.workActivityFindFirst,
    },
  },
}));

vi.mock('../../estimates/application/estimation-reference.service.js', () => ({
  linkEstimationReference: mocks.linkReference,
}));

vi.mock('../../estimates/application/work-activity.service.js', () => ({
  createEstimateRevisionForActivity: mocks.createRevision,
}));

import { listAuthorizedMcpTools, invokeMcpTool } from './mcp-tools.service.js';

describe('mcp-tools.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flows.mockResolvedValue({ mcp: true, estimates: true });
    mocks.grants.mockResolvedValue([
      { permission: 'mcp.use', scope: 'self' },
      { permission: 'clients.read', scope: 'self' },
      { permission: 'estimates.read', scope: 'self' },
      { permission: 'estimates.propose', scope: 'self' },
      { permission: 'time.write', scope: 'self' },
    ]);
    mocks.auditCreate.mockResolvedValue({ id: 1 });
  });

  it('bloqueia catalogo quando flow mcp esta off', async () => {
    mocks.flows.mockResolvedValue({ mcp: false, estimates: true });
    await expect(listAuthorizedMcpTools(1)).rejects.toMatchObject({ message: 'FLOW_DISABLED' });
  });

  it('rejeita ferramenta financeira fora do catalogo', async () => {
    await expect(
      invokeMcpTool({ userId: 1, toolName: 'closing.approve', arguments: {} })
    ).rejects.toMatchObject({ message: 'MCP_TOOL_FORBIDDEN' });
  });

  it('estimates.create_proposal persiste EstimateRevision quando workActivityId e informado', async () => {
    mocks.createRevision.mockResolvedValue({
      revision: { id: 7, uuid: 'rev-1', suggestedMinutes: 150, origin: 'MCP' },
      mutatesCatalog: false,
      syncedEntryCount: 1,
    });

    const result = await invokeMcpTool({
      userId: 1,
      toolName: 'estimates.create_proposal',
      arguments: {
        workActivityId: 3,
        baseMinutes: 120,
        factor: 1.25,
        reason: 'mcp propose',
      },
    });

    expect(mocks.createRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 1,
        workActivityId: 3,
        baseMinutes: 120,
        factor: 1.25,
        origin: 'MCP',
      })
    );
    expect(result).toMatchObject({
      confirmed: false,
      persisted: true,
      revision: expect.objectContaining({ uuid: 'rev-1' }),
    });
  });

  it('estimates.link_reference vincula evidencia sem marcar Actual Tracked', async () => {
    mocks.linkReference.mockResolvedValue({
      id: 9,
      uuid: 'ref-mcp',
      kind: 'COMMIT',
      provider: 'github',
      externalId: 'abc123',
      isActualTrackedEvidence: false,
    });

    const result = await invokeMcpTool({
      userId: 1,
      toolName: 'estimates.link_reference',
      arguments: {
        kind: 'COMMIT',
        provider: 'github',
        externalId: 'abc123',
        repository: 'org/repo',
        timeEntryId: 42,
      },
    });

    expect(mocks.linkReference).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 1,
        kind: 'COMMIT',
        provider: 'github',
        externalId: 'abc123',
        repository: 'org/repo',
        timeEntryId: 42,
        presentAsActualTracked: false,
      })
    );
    expect(result).toMatchObject({
      reference: expect.objectContaining({ uuid: 'ref-mcp' }),
      confirmed: false,
      isActualTracked: false,
    });
  });

  it('activities.get devolve atividade sem inventar Actual Tracked', async () => {
    mocks.workActivityFindUnique.mockResolvedValue({
      id: 3,
      uuid: 'act-1',
      title: 'Endpoint',
      description: null,
      state: 'OPEN',
      clientId: 1,
      projectId: null,
      ownerUserId: 1,
      version: 1,
    });

    const result = await invokeMcpTool({
      userId: 1,
      toolName: 'activities.get',
      arguments: { id: 3 },
    });

    expect(mocks.workActivityFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 3 } })
    );
    expect(result).toMatchObject({
      activity: expect.objectContaining({
        uuid: 'act-1',
        actualTrackedDurationMinutes: null,
      }),
    });
  });

  it('time_entries.propose nao cria apontamento reconhecido', async () => {
    const result = await invokeMcpTool({
      userId: 1,
      toolName: 'time_entries.propose',
      arguments: {
        clientId: 9,
        date: '2026-10-15',
        durationMinutes: 90,
        activityDescription: 'Draft only',
      },
    });

    expect(mocks.auditCreate).toHaveBeenCalled();
    expect(result).toMatchObject({
      confirmed: false,
      created: false,
      proposal: expect.objectContaining({
        clientId: 9,
        date: '2026-10-15',
        durationMinutes: 90,
        source: 'MCP_PROPOSE',
      }),
    });
  });
});
