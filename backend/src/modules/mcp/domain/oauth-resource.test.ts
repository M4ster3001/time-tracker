import { describe, expect, it } from 'vitest';
import {
  MCP_PROTOCOL_VERSION,
  MCP_RESOURCE_TEMPLATES,
  buildMcpOAuthResourceConfig,
  buildProtectedResourceMetadata,
  matchMcpResourceUri,
} from './oauth-resource.js';

describe('MCP-01 OAuth resource scaffolding (no live IdP)', () => {
  it('sem env: status not_configured — nao finge OAuth de producao', () => {
    const config = buildMcpOAuthResourceConfig({});
    const meta = buildProtectedResourceMetadata(config);
    expect(meta.status).toBe('not_configured');
    expect(meta.authorization_servers).toEqual([]);
    expect(meta.mcp_protocol_version).toBe(MCP_PROTOCOL_VERSION);
  });

  it('com resource + issuer: metadados RFC-style configurados', () => {
    const config = buildMcpOAuthResourceConfig({
      resourceUri: 'https://app.example/mcp',
      authorizationServers: 'https://idp.example',
      scopesSupported: 'mcp.use,estimates.read',
      documentationUrl: 'https://docs.example/mcp',
    });
    const meta = buildProtectedResourceMetadata(config);
    expect(meta.status).toBe('configured');
    expect(meta.resource).toBe('https://app.example/mcp');
    expect(meta.authorization_servers).toEqual(['https://idp.example']);
    expect(meta.scopes_supported).toEqual(['mcp.use', 'estimates.read']);
    expect(meta.resource_documentation).toBe('https://docs.example/mcp');
  });

  it('cataloga templates tts:// do plano §6.2', () => {
    expect(MCP_RESOURCE_TEMPLATES.map((t) => t.uriTemplate)).toEqual([
      'tts://projects/{uuid}/context',
      'tts://estimates/{uuid}/explanation',
    ]);
  });

  it('matchMcpResourceUri extrai uuid sem carregar dados', () => {
    const hit = matchMcpResourceUri(
      'tts://projects/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/context'
    );
    expect(hit?.template.name).toBe('Project context');
    expect(hit?.params.uuid).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(matchMcpResourceUri('tts://unknown/x')).toBeNull();
  });
});
