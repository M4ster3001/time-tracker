/**
 * MCP stdio Content-Length framing (LSP-style) for hosts that do not use NDJSON lines.
 * Pure codec — no auth, no IdP.
 */

export type StdioFramingMode = 'content-length' | 'ndjson' | 'unknown';

const HEADER_RE = /^Content-Length:\s*(\d+)\r?\n\r?\n/i;

export const encodeContentLengthFrame = (body: string): string => {
  const byteLen = Buffer.byteLength(body, 'utf8');
  return `Content-Length: ${byteLen}\r\n\r\n${body}`;
};

export const detectStdioFramingMode = (chunk: string): StdioFramingMode => {
  const trimmedStart = chunk.replace(/^\uFEFF/, '');
  if (!trimmedStart.trim()) return 'unknown';
  if (/^Content-Length:\s*\d+/i.test(trimmedStart)) return 'content-length';
  if (trimmedStart.trimStart().startsWith('{')) return 'ndjson';
  return 'unknown';
};

export const extractContentLengthFrames = (
  buffer: string
): { messages: string[]; rest: string } => {
  const messages: string[] = [];
  let rest = buffer;

  while (rest.length > 0) {
    const match = rest.match(HEADER_RE);
    if (!match || match.index == null) break;
    const declared = Number(match[1]);
    if (!Number.isSafeInteger(declared) || declared < 0) break;
    const headerLen = match[0].length;
    const bodyStart = match.index + headerLen;
    const bodyBytes = Buffer.from(rest.slice(bodyStart), 'utf8');
    if (bodyBytes.length < declared) break;
    const body = bodyBytes.subarray(0, declared).toString('utf8');
    // Advance by character length corresponding to declared UTF-8 bytes.
    let consumedChars = 0;
    let consumedBytes = 0;
    while (consumedBytes < declared && bodyStart + consumedChars < rest.length) {
      const ch = rest[bodyStart + consumedChars]!;
      consumedBytes += Buffer.byteLength(ch, 'utf8');
      consumedChars += 1;
    }
    messages.push(body);
    rest = rest.slice(bodyStart + consumedChars);
  }

  return { messages, rest };
};
