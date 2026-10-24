#!/usr/bin/env node
/**
 * Wait until GET /health returns 200. Exits 1 on timeout (never masks failure).
 *
 * Usage:
 *   node scripts/wait-backend-health.mjs
 *   node scripts/wait-backend-health.mjs --url http://127.0.0.1:5000/health --tries 40
 */
const args = process.argv.slice(2);
const url =
  args.find((_, i) => args[i - 1] === '--url') ||
  process.env.BACKEND_HEALTH_URL ||
  'http://127.0.0.1:5000/health';
const tries = Number(
  args.find((_, i) => args[i - 1] === '--tries') || process.env.BACKEND_HEALTH_TRIES || 40
);
const delayMs = Number(
  args.find((_, i) => args[i - 1] === '--delay-ms') || process.env.BACKEND_HEALTH_DELAY_MS || 1000
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastCode = '000';
let lastError = '';

for (let i = 1; i <= tries; i += 1) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    lastCode = String(res.status);
    console.log(`health try ${i}/${tries}: ${lastCode}`);
    if (res.ok) {
      process.exit(0);
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    lastCode = '000';
    console.log(`health try ${i}/${tries}: ${lastCode} (${lastError})`);
  }
  if (i < tries) await sleep(delayMs);
}

console.error(
  `Backend health failed after ${tries} tries: ${url} last=${lastCode}${lastError ? ` ${lastError}` : ''}`
);
process.exit(1);
