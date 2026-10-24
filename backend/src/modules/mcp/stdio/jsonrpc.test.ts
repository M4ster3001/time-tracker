import { describe, expect, it } from 'vitest';
import { handleMcpStdioMessage, type StdioToolRunner } from './jsonrpc.js';

const runner: StdioToolRunner = {
  listTools: async () => [
    { name: 'estimates.preview', description: 'preview', effect: 'propose' as const },
  ],
  callTool: async (name, args) => ({ name, echo: args }),
};

describe('MCP stdio JSON-RPC adapter', () => {
  it('responde initialize e tools/list com o mesmo catalogo', async () => {
    const init = await handleMcpStdioMessage(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'test' } },
      },
      runner
    );
    expect(init).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: expect.objectContaining({
        protocolVersion: '2026-07-28',
        serverInfo: expect.objectContaining({ name: 'time-tracker' }),
      }),
    });

    const list = await handleMcpStdioMessage(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      runner
    );
    expect(list).toMatchObject({
      id: 2,
      result: {
        tools: [{ name: 'estimates.preview', description: 'preview', inputSchema: expect.any(Object) }],
      },
    });
  });

  it('encaminha tools/call para o runner compartilhado com HTTP', async () => {
    const call = await handleMcpStdioMessage(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'estimates.preview', arguments: { baseMinutes: 60, factor: 1 } },
      },
      runner
    );
    expect(call).toMatchObject({
      id: 3,
      result: {
        content: [
          {
            type: 'text',
            text: expect.stringContaining('estimates.preview'),
          },
        ],
      },
    });
  });

  it('retorna erro JSON-RPC para metodo desconhecido', async () => {
    const res = await handleMcpStdioMessage(
      { jsonrpc: '2.0', id: 9, method: 'prompts/list' },
      runner
    );
    expect(res).toMatchObject({
      id: 9,
      error: expect.objectContaining({ code: -32601 }),
    });
  });

  it('resources/list e resources/read usam o runner compartilhado', async () => {
    const withResources: typeof runner = {
      ...runner,
      listResources: async () => [
        {
          uri: 'tts://projects/{uuid}/context',
          name: 'Project context',
          description: 'ctx',
          mimeType: 'application/json',
        },
      ],
      readResource: async (uri) => ({
        uri,
        mimeType: 'application/json',
        content: { kind: 'project_context', project: { uuid: 'p1' } },
      }),
    };

    const list = await handleMcpStdioMessage(
      { jsonrpc: '2.0', id: 4, method: 'resources/list' },
      withResources
    );
    expect(list).toMatchObject({
      id: 4,
      result: {
        resources: [
          expect.objectContaining({ uri: 'tts://projects/{uuid}/context' }),
        ],
      },
    });

    const init = await handleMcpStdioMessage(
      { jsonrpc: '2.0', id: 5, method: 'initialize', params: {} },
      withResources
    );
    expect(init.result).toMatchObject({
      capabilities: expect.objectContaining({ resources: {} }),
    });

    const read = await handleMcpStdioMessage(
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'resources/read',
        params: { uri: 'tts://projects/p1/context' },
      },
      withResources
    );
    expect(read).toMatchObject({
      id: 6,
      result: {
        contents: [
          expect.objectContaining({
            uri: 'tts://projects/p1/context',
            mimeType: 'application/json',
            text: expect.stringContaining('project_context'),
          }),
        ],
      },
    });
  });
});
