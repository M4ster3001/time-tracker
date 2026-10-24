/**
 * Entrypoint MCP stdio local.
 *
 * Env:
 * - TIME_TRACKER_MCP_USER_ID (obrigatorio) — identidade do ator
 * - flow `mcp` deve estar habilitado (FeatureSetting); default off
 *
 * Framing: auto-detect Content-Length (LSP-style) ou NDJSON linha a linha.
 * Uso: npm run mcp:stdio — (Cursor/host aponta o comando neste entrypoint)
 * OAuth IdP remoto: ver docs/MCP_01_SERVER.md (blocked-on-host).
 */

import { handleMcpStdioMessage, type StdioToolRunner } from './jsonrpc.js';
import { invokeMcpTool, listAuthorizedMcpTools } from '../application/mcp-tools.service.js';
import {
  listMcpResourcesForActor,
  readMcpResource,
} from '../application/mcp-resources.service.js';
import {
  detectStdioFramingMode,
  encodeContentLengthFrame,
  extractContentLengthFrames,
  type StdioFramingMode,
} from '../domain/content-length-framing.js';

const userId = Number(process.env.TIME_TRACKER_MCP_USER_ID);
if (!Number.isSafeInteger(userId) || userId <= 0) {
  process.stderr.write(
    'TIME_TRACKER_MCP_USER_ID must be a positive integer (actor for ACL).\n'
  );
  process.exit(1);
}

const runner: StdioToolRunner = {
  listTools: async () => {
    const tools = await listAuthorizedMcpTools(userId);
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      effect: t.effect,
    }));
  },
  callTool: async (name, args) =>
    invokeMcpTool({
      userId,
      toolName: name,
      arguments: args,
    }),
  listResources: async () => listMcpResourcesForActor(userId),
  readResource: async (uri) => {
    const result = await readMcpResource({ userId, uri });
    return { uri: result.uri, mimeType: result.mimeType, content: result.content };
  },
};

let framingMode: StdioFramingMode = 'unknown';
let clBuffer = '';
let ndjsonCarry = '';

const writeResponse = (response: unknown, mode: StdioFramingMode): void => {
  const payload = JSON.stringify(response);
  if (mode === 'content-length') {
    process.stdout.write(encodeContentLengthFrame(payload));
    return;
  }
  process.stdout.write(`${payload}\n`);
};

const handleParsedMessage = async (raw: string): Promise<void> => {
  try {
    const message = JSON.parse(raw) as {
      jsonrpc?: string;
      id?: string | number | null;
      method?: string;
      params?: unknown;
    };
    // Notifications without id: ignore response (MCP initialized).
    if (message.id === undefined && message.method?.startsWith('notifications/')) {
      await handleMcpStdioMessage(message, runner);
      return;
    }
    const response = await handleMcpStdioMessage(message, runner);
    writeResponse(response, framingMode === 'content-length' ? 'content-length' : 'ndjson');
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    writeResponse(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: messageText },
      },
      framingMode === 'content-length' ? 'content-length' : 'ndjson'
    );
  }
};

const processNdjsonChunk = async (chunk: string): Promise<void> => {
  ndjsonCarry += chunk;
  const lines = ndjsonCarry.split(/\r?\n/);
  ndjsonCarry = lines.pop() ?? '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    await handleParsedMessage(trimmed);
  }
};

const processContentLengthChunk = async (chunk: string): Promise<void> => {
  clBuffer += chunk;
  const { messages, rest } = extractContentLengthFrames(clBuffer);
  clBuffer = rest;
  for (const message of messages) {
    await handleParsedMessage(message);
  }
};

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string | Buffer) => {
  const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
  void (async () => {
    if (framingMode === 'unknown') {
      framingMode = detectStdioFramingMode(text);
      if (framingMode === 'unknown') {
        // Wait for more bytes (partial header or whitespace).
        clBuffer += text;
        if (clBuffer.length > 64) {
          framingMode = detectStdioFramingMode(clBuffer) === 'content-length'
            ? 'content-length'
            : 'ndjson';
          const buffered = clBuffer;
          clBuffer = '';
          if (framingMode === 'content-length') {
            await processContentLengthChunk(buffered);
          } else {
            await processNdjsonChunk(buffered);
          }
        }
        return;
      }
      if (framingMode === 'content-length') {
        await processContentLengthChunk(text);
      } else {
        await processNdjsonChunk(text);
      }
      return;
    }
    if (framingMode === 'content-length') {
      await processContentLengthChunk(text);
    } else {
      await processNdjsonChunk(text);
    }
  })();
});

process.stdin.on('end', () => process.exit(0));
