import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_MCP_TOOLS,
  listMcpToolsForGrants,
  resolveMcpToolPermission,
  type McpToolDefinition,
} from './tool-catalog.js';
import type { Grant } from '../../access-control/domain/permissions.js';

const allReadPropose: Grant[] = [
  { permission: 'clients.read', scope: 'self' },
  { permission: 'projects.read', scope: 'self' },
  { permission: 'time.read', scope: 'self' },
  { permission: 'time.write', scope: 'self' },
  { permission: 'estimates.read', scope: 'self' },
  { permission: 'estimates.propose', scope: 'self' },
  { permission: 'mcp.use', scope: 'self' },
];

describe('MCP-01/02 tool catalog', () => {
  it('expoe leitura e preview/propose sem ferramentas financeiras', () => {
    const tools = listMcpToolsForGrants(allReadPropose, { mcp: true, estimates: true });
    const names = tools.map((t: McpToolDefinition) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'clients.list',
        'projects.list',
        'activities.get',
        'time_entries.list',
        'time_entries.propose',
        'estimation_parameters.list',
        'estimates.preview',
        'estimates.create_proposal',
        'estimates.link_reference',
      ])
    );
    for (const forbidden of FORBIDDEN_MCP_TOOLS) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('oculta tools quando flow mcp esta desligado', () => {
    expect(listMcpToolsForGrants(allReadPropose, { mcp: false, estimates: true })).toEqual([]);
  });

  it('oculta estimates.* sem permissao de propose/read', () => {
    const grants: Grant[] = [
      { permission: 'mcp.use', scope: 'self' },
      { permission: 'clients.read', scope: 'self' },
    ];
    const names = listMcpToolsForGrants(grants, { mcp: true, estimates: true }).map((t) => t.name);
    expect(names).toContain('clients.list');
    expect(names).not.toContain('estimates.preview');
    expect(names).not.toContain('estimates.create_proposal');
  });

  it('mapeia tool para a mesma permissao do portal', () => {
    expect(resolveMcpToolPermission('clients.list')).toBe('clients.read');
    expect(resolveMcpToolPermission('estimates.preview')).toBe('estimates.propose');
    expect(resolveMcpToolPermission('estimates.link_reference')).toBe('estimates.propose');
    expect(resolveMcpToolPermission('closing.approve')).toBeNull();
  });
});
