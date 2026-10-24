import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../index.css'),
  'utf8'
);

/** Extract first `prop: value` assignment inside a selector block (best-effort for contract tests). */
const readTokenInBlock = (blockStart: string, prop: string): string | null => {
  const start = css.indexOf(blockStart);
  if (start < 0) return null;
  const open = css.indexOf('{', start);
  if (open < 0) return null;
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = css.slice(open + 1, end);
  const match = block.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`));
  return match?.[1]?.trim() ?? null;
};

const remToPx = (rem: string): number => {
  const n = Number.parseFloat(rem);
  if (!Number.isFinite(n) || !rem.endsWith('rem')) {
    throw new Error(`expected rem token, got ${rem}`);
  }
  return n * 16;
};

describe('workspace layout density spacing tokens', () => {
  it('defines comfortable --tt-space-* and --tt-gap-* on :root', () => {
    expect(readTokenInBlock(':root {', '--tt-space-panel')).toBe('1.25rem');
    expect(readTokenInBlock(':root {', '--tt-space-nav-y')).toBe('0.75rem');
    expect(readTokenInBlock(':root {', '--tt-space-nav-section')).toBe('1rem');
    expect(readTokenInBlock(':root {', '--tt-space-metric')).toBe('1.25rem');
    expect(readTokenInBlock(':root {', '--tt-gap-panel')).toBe('1.5rem');
  });

  it('compact density overrides tokens to a visibly tighter scale', () => {
    const compactStart = "html[data-density='compact']";
    const panel = readTokenInBlock(compactStart, '--tt-space-panel');
    const navY = readTokenInBlock(compactStart, '--tt-space-nav-y');
    const navSection = readTokenInBlock(compactStart, '--tt-space-nav-section');
    const metric = readTokenInBlock(compactStart, '--tt-space-metric');
    const gapPanel = readTokenInBlock(compactStart, '--tt-gap-panel');

    expect(panel).toBeTruthy();
    expect(navY).toBeTruthy();
    expect(navSection).toBeTruthy();
    expect(metric).toBeTruthy();
    expect(gapPanel).toBeTruthy();

    // Comfortable → compact should drop by ~40%+ on structural spacing.
    expect(remToPx(panel!)).toBeLessThanOrEqual(12); // ≤0.75rem
    expect(remToPx(navY!)).toBeLessThanOrEqual(8); // ≤0.5rem
    expect(remToPx(navSection!)).toBeLessThanOrEqual(8); // ≤0.5rem
    expect(remToPx(metric!)).toBeLessThanOrEqual(12); // ≤0.75rem
    expect(remToPx(gapPanel!)).toBeLessThanOrEqual(12); // ≤0.75rem
  });

  it('wires panels, nav, sidebar, controls and metric cards to density tokens', () => {
    expect(css).toMatch(/\.tt-panel[\s\S]*?padding:\s*var\(--tt-space-panel\)/);
    expect(css).toMatch(/\.tt-nav-link[\s\S]*?padding:\s*var\(--tt-space-nav-y\)\s+var\(--tt-space-nav-x\)/);
    expect(css).toMatch(/\.tt-sidebar\s*\{[\s\S]*?padding:\s*var\(--tt-space-sidebar\)/);
    expect(css).toMatch(
      /\.tt-input[\s\S]*?padding:\s*var\(--tt-space-control-y\)\s+var\(--tt-space-control-x\)/
    );
    expect(css).toMatch(/\.tt-metric-card\s*\{[\s\S]*?padding:\s*var\(--tt-space-metric\)/);
    expect(css).toMatch(/\.tt-nav-stack\s*\{[\s\S]*?gap:\s*var\(--tt-space-nav-section\)/);
  });

  it('wires workspace and dashboard stacks/grids to --tt-gap-* tokens', () => {
    expect(css).toMatch(
      /\.tt-shell-workspace\s*\{[\s\S]*?gap:\s*var\(--tt-gap-panel\)/
    );
    expect(css).toMatch(/\.tt-page-stack\s*\{[\s\S]*?gap:\s*var\(--tt-gap-panel\)/);
    expect(css).toMatch(/\.tt-metric-grid\s*\{[\s\S]*?gap:\s*var\(--tt-gap-metric\)/);
    expect(css).toMatch(/\.tt-panel-grid\s*\{[\s\S]*?gap:\s*var\(--tt-gap-panel\)/);
  });
});
