import { describe, expect, it } from 'vitest';
import {
  buildEstimateExplanationResourceBody,
  buildProjectContextResourceBody,
  listMcpResourceCatalogEntries,
} from './mcp-resource-body.js';

describe('MCP resource body builders (ACL-gated payload shapes)', () => {
  it('listMcpResourceCatalogEntries exposes tts:// templates for resources/list', () => {
    const entries = listMcpResourceCatalogEntries();
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uri: 'tts://projects/{uuid}/context',
          name: 'Project context',
          mimeType: 'application/json',
        }),
        expect.objectContaining({
          uri: 'tts://estimates/{uuid}/explanation',
          name: 'Estimate explanation',
          mimeType: 'application/json',
        }),
      ])
    );
  });

  it('buildProjectContextResourceBody omits tariffs and secrets', () => {
    const body = buildProjectContextResourceBody({
      uuid: 'proj-1',
      code: 'API',
      name: 'Portal',
      state: 'ACTIVE',
      description: 'desc',
      client: { uuid: 'cli-1', code: 'ACME', name: 'Acme' },
    });
    expect(body).toEqual({
      kind: 'project_context',
      project: {
        uuid: 'proj-1',
        code: 'API',
        name: 'Portal',
        state: 'ACTIVE',
        description: 'desc',
      },
      client: { uuid: 'cli-1', code: 'ACME', name: 'Acme' },
      note: 'Minimal project context; ACL revalidated on read; financial fields omitted',
    });
    expect(body).not.toHaveProperty('tariff');
    expect(body.project).not.toHaveProperty('email');
    expect(Object.keys(body)).toEqual(['kind', 'project', 'client', 'note']);
  });

  it('buildEstimateExplanationResourceBody exposes formula fields without confirming hours', () => {
    const body = buildEstimateExplanationResourceBody({
      uuid: 'est-1',
      version: 2,
      baseMinutes: 60,
      factor: 1.5,
      rawMinutes: 90,
      suggestedMinutes: 90,
      roundingMode: 'NEAREST_MINUTE',
      origin: 'MCP',
      algorithmVersion: 'EST-01',
      parameterRevisionUuid: 'param-1',
      reason: 'preview',
      workActivity: { uuid: 'wa-1', title: 'Implement MCP', state: 'OPEN' },
      allowedReferences: [
        {
          uuid: 'ref-1',
          kind: 'COMMIT',
          provider: 'local-git',
          externalId: 'abc',
          title: 'feat',
          uri: null,
          isActualTrackedEvidence: false,
        },
      ],
    });
    expect(body.kind).toBe('estimate_explanation');
    expect(body.confirmed).toBe(false);
    expect(body.isActualTracked).toBe(false);
    expect(body.revision.suggestedMinutes).toBe(90);
    expect(body.allowedReferences[0]?.isActualTrackedEvidence).toBe(false);
    expect(body.note).toMatch(/not Actual Tracked/i);
  });
});
