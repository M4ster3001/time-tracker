import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = {
  getFlows: vi.fn(),
  getUserGrants: vi.fn(),
  projectFindFirst: vi.fn(),
  estimateFindFirst: vi.fn(),
  referenceFindMany: vi.fn(),
};

vi.mock('../../access-control/application/access-control.service.js', () => ({
  getFlows: (...args: unknown[]) => mocks.getFlows(...args),
  getUserGrants: (...args: unknown[]) => mocks.getUserGrants(...args),
}));

vi.mock('../../../shared/infrastructure/db/prisma.js', () => ({
  prisma: {
    project: { findFirst: (...args: unknown[]) => mocks.projectFindFirst(...args) },
    estimateRevision: { findFirst: (...args: unknown[]) => mocks.estimateFindFirst(...args) },
    estimationReference: { findMany: (...args: unknown[]) => mocks.referenceFindMany(...args) },
  },
}));

import { listMcpResourcesForActor, readMcpResource } from './mcp-resources.service.js';

describe('MCP resources service (JWT/PAT ACL, no IdP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFlows.mockResolvedValue({ mcp: true, estimates: true });
    mocks.getUserGrants.mockResolvedValue([
      { permission: 'mcp.use', scope: 'self' },
      { permission: 'projects.read', scope: 'all' },
      { permission: 'estimates.read', scope: 'all' },
    ]);
  });

  it('lista catalogo tts:// quando mcp.use', async () => {
    const resources = await listMcpResourcesForActor(7);
    expect(resources.map((r) => r.uri)).toEqual([
      'tts://projects/{uuid}/context',
      'tts://estimates/{uuid}/explanation',
    ]);
  });

  it('le project context com corpo JSON minimo', async () => {
    mocks.projectFindFirst.mockResolvedValue({
      uuid: 'p-uuid',
      code: 'API',
      name: 'Portal',
      state: 'ACTIVE',
      description: null,
      client: { uuid: 'c-uuid', code: 'ACME', name: 'Acme' },
    });
    const result = await readMcpResource({
      userId: 7,
      uri: 'tts://projects/p-uuid/context',
    });
    expect(result.status).toBe('ok');
    expect(result.content).toMatchObject({
      kind: 'project_context',
      project: { uuid: 'p-uuid', code: 'API' },
    });
  });

  it('le estimate explanation sem marcar Actual Tracked', async () => {
    mocks.estimateFindFirst.mockResolvedValue({
      uuid: 'e-uuid',
      version: 1,
      baseMinutes: 30,
      factor: 2,
      rawMinutes: 60,
      suggestedMinutes: 60,
      roundingMode: 'NEAREST_MINUTE',
      origin: 'MCP',
      algorithmVersion: 'EST-01',
      parameterRevisionUuid: null,
      reason: null,
      workActivity: {
        uuid: 'wa',
        title: 'Task',
        state: 'OPEN',
        id: 9,
        timeEntries: [{ id: 11 }],
      },
    });
    mocks.referenceFindMany.mockResolvedValue([
      {
        uuid: 'r1',
        kind: 'COMMIT',
        provider: 'local-git',
        externalId: 'sha',
        title: 'msg',
        uri: null,
      },
    ]);
    const result = await readMcpResource({
      userId: 7,
      uri: 'tts://estimates/e-uuid/explanation',
    });
    expect(result.content).toMatchObject({
      kind: 'estimate_explanation',
      confirmed: false,
      isActualTracked: false,
      allowedReferences: [{ isActualTrackedEvidence: false }],
    });
  });

  it('rejeita URI desconhecida', async () => {
    await expect(
      readMcpResource({ userId: 7, uri: 'tts://unknown/x' })
    ).rejects.toMatchObject({ message: expect.stringMatching(/UNKNOWN_MCP_RESOURCE/) });
  });
});
