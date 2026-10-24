import { describe, expect, it } from 'vitest';
import {
  detectStdioFramingMode,
  encodeContentLengthFrame,
  extractContentLengthFrames,
} from './content-length-framing.js';

describe('MCP stdio Content-Length framing', () => {
  it('encodeContentLengthFrame prefixes UTF-8 byte length and blank line', () => {
    const body = '{"jsonrpc":"2.0","id":1,"result":{}}';
    const frame = encodeContentLengthFrame(body);
    const byteLen = Buffer.byteLength(body, 'utf8');
    expect(frame).toBe(`Content-Length: ${byteLen}\r\n\r\n${body}`);
  });

  it('extractContentLengthFrames parses one or more frames and keeps remainder', () => {
    const a = encodeContentLengthFrame('{"id":1}');
    const b = encodeContentLengthFrame('{"id":2}');
    const partial = 'Content-Length: 9\r\n\r\n{"id":';
    const { messages, rest } = extractContentLengthFrames(a + b + partial);
    expect(messages).toEqual(['{"id":1}', '{"id":2}']);
    expect(rest).toBe(partial);
  });

  it('extractContentLengthFrames accepts LF-only headers used by some hosts', () => {
    const body = '{"ping":true}';
    const frame = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\n\n${body}`;
    const { messages, rest } = extractContentLengthFrames(frame);
    expect(messages).toEqual([body]);
    expect(rest).toBe('');
  });

  it('detectStdioFramingMode distinguishes Content-Length from NDJSON', () => {
    expect(detectStdioFramingMode('Content-Length: 12\r\n\r\n')).toBe('content-length');
    expect(detectStdioFramingMode('content-length: 12\n\n')).toBe('content-length');
    expect(detectStdioFramingMode('{"jsonrpc":"2.0","id":1}\n')).toBe('ndjson');
    expect(detectStdioFramingMode('')).toBe('unknown');
    expect(detectStdioFramingMode('   ')).toBe('unknown');
  });
});
