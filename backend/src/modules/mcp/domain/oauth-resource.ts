/**
 * MCP-01 — scaffolding de OAuth Protected Resource + catalogo tts:// (plano §6.2–6.3).
 * Sem IdP vivo: metadados e templates; nao emite tokens nem finge autorizacao de producao.
 */

export const MCP_PROTOCOL_VERSION = '2026-07-28';

export type McpOAuthResourceConfig = {
  /** Quando vazio, discovery responde "not configured". */
  resourceUri: string;
  authorizationServers: string[];
  scopesSupported: string[];
  bearerMethodsSupported: string[];
  resourceDocumentation: string | null;
};

export type McpProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_documentation?: string;
  mcp_protocol_version: string;
  status: 'configured' | 'not_configured';
};

export type McpResourceTemplate = {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
};

export const DEFAULT_MCP_SCOPES = ['mcp.use', 'estimates.read'] as const;

export const MCP_RESOURCE_TEMPLATES: McpResourceTemplate[] = [
  {
    uriTemplate: 'tts://projects/{uuid}/context',
    name: 'Project context',
    description: 'Minimal project context for the assistant; ACL revalidated on read.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'tts://estimates/{uuid}/explanation',
    name: 'Estimate explanation',
    description: 'Formula, revisions and allowed reference; no secrets or other users.',
    mimeType: 'application/json',
  },
];

export const buildMcpOAuthResourceConfig = (env: {
  resourceUri?: string | null;
  authorizationServers?: string | null;
  scopesSupported?: string | null;
  documentationUrl?: string | null;
}): McpOAuthResourceConfig => {
  const resourceUri = (env.resourceUri ?? '').trim();
  const authorizationServers = (env.authorizationServers ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const scopesSupported = (env.scopesSupported ?? DEFAULT_MCP_SCOPES.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    resourceUri,
    authorizationServers,
    scopesSupported: scopesSupported.length > 0 ? scopesSupported : [...DEFAULT_MCP_SCOPES],
    bearerMethodsSupported: ['header'],
    resourceDocumentation: (env.documentationUrl ?? '').trim() || null,
  };
};

export const buildProtectedResourceMetadata = (
  config: McpOAuthResourceConfig
): McpProtectedResourceMetadata => {
  const configured =
    config.resourceUri.length > 0 && config.authorizationServers.length > 0;
  const metadata: McpProtectedResourceMetadata = {
    resource: config.resourceUri || 'urn:time-tracker:mcp:not-configured',
    authorization_servers: config.authorizationServers,
    scopes_supported: config.scopesSupported,
    bearer_methods_supported: config.bearerMethodsSupported,
    mcp_protocol_version: MCP_PROTOCOL_VERSION,
    status: configured ? 'configured' : 'not_configured',
  };
  if (config.resourceDocumentation) {
    metadata.resource_documentation = config.resourceDocumentation;
  }
  return metadata;
};

/** Resolve template path params; nao busca dados — so valida forma do URI. */
export const matchMcpResourceUri = (
  uri: string
): { template: McpResourceTemplate; params: Record<string, string> } | null => {
  const trimmed = uri.trim();
  for (const template of MCP_RESOURCE_TEMPLATES) {
    const pattern = template.uriTemplate.replace(/\{([a-zA-Z]+)\}/g, '([^/]+)');
    const re = new RegExp(`^${pattern}$`);
    const match = trimmed.match(re);
    if (!match) continue;
    const names = [...template.uriTemplate.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]!);
    const params: Record<string, string> = {};
    names.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1] ?? '');
    });
    return { template, params };
  }
  return null;
};
