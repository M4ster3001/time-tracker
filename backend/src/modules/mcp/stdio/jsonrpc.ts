/**
 * Adaptador MCP stdio (JSON-RPC 2.0) — mesmo catalogo/tools/resources que /api/mcp.
 * Protocolo fixado em 2026-07-28; OAuth IdP remoto permanece blocked-on-host.
 */

export type StdioToolSummary = {
  name: string;
  description: string;
  effect: 'read' | 'propose';
};

export type StdioResourceSummary = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
};

export type StdioToolRunner = {
  listTools: () => Promise<StdioToolSummary[]>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  listResources?: () => Promise<StdioResourceSummary[]>;
  readResource?: (uri: string) => Promise<{
    uri: string;
    mimeType: string;
    content: unknown;
  }>;
};

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const defaultInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: true,
};

export const handleMcpStdioMessage = async (
  message: JsonRpcRequest,
  runner: StdioToolRunner
): Promise<JsonRpcResponse> => {
  const id = message.id ?? null;
  const method = message.method ?? '';

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2026-07-28',
        capabilities: {
          tools: {},
          resources: runner.listResources ? {} : undefined,
        },
        serverInfo: { name: 'time-tracker', version: '1.0.0' },
      },
    };
  }

  if (method === 'notifications/initialized' || method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (method === 'tools/list') {
    const tools = await runner.listTools();
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: defaultInputSchema,
        })),
      },
    };
  }

  if (method === 'tools/call') {
    const params = (message.params ?? {}) as {
      name?: string;
      arguments?: Record<string, unknown>;
    };
    const name = String(params.name ?? '').trim();
    if (!name) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: 'tool name required' },
      };
    }
    try {
      const result = await runner.callTool(name, params.arguments ?? {});
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: messageText },
      };
    }
  }

  if (method === 'resources/list' || method === 'resources/templates/list') {
    if (!runner.listResources) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
    }
    const resources = await runner.listResources();
    if (method === 'resources/templates/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resourceTemplates: resources.map((r) => ({
            uriTemplate: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType,
          })),
        },
      };
    }
    return {
      jsonrpc: '2.0',
      id,
      result: {
        resources: resources.map((r) => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType,
        })),
      },
    };
  }

  if (method === 'resources/read') {
    if (!runner.readResource) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
    }
    const params = (message.params ?? {}) as { uri?: string };
    const uri = String(params.uri ?? '').trim();
    if (!uri) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: 'uri required' },
      };
    }
    try {
      const read = await runner.readResource(uri);
      const text = JSON.stringify(read.content);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri: read.uri,
              mimeType: read.mimeType,
              text,
            },
          ],
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: messageText },
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
};
