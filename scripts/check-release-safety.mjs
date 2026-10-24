import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const ignoredDirectories = new Set(['.git', 'node_modules', '.turbo', '.cache', 'dist', 'build', 'coverage']);
const allowedEnvExamples = new Set(['.env.example', '.env.docker.example']);
const textExtensions = new Set([
  '.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.css', '.html',
  '.yml', '.yaml', '.toml', '.example', '.svg', '.xml', '.sh', '.sql',
]);
const formerBrandPattern = /(?:\bT\d{2}\b(?!:)|t\d{2}\.digital|tt-t\d{2}|T\d{2}Logo|MCP_OAUTH_T\d{2})/i;

const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      if (/^(?:backups|\.generated|\.claude|\.codex|layout-previews)$/.test(entry.name)) {
        failures.push(`${relative}: local or internal directory must not be published`);
        continue;
      }
      walk(absolute);
      continue;
    }
    if (!entry.isFile()) continue;
    if (/\.(?:zip|pem|key|p12|pfx|db|sqlite3?|sql\.gz)$/i.test(entry.name)) {
      failures.push(`${relative}: private, backup or generated artifact`);
    }
    if (/(?:^|\/)\.env(?:$|\.)/.test(relative) && !allowedEnvExamples.has(entry.name)) {
      failures.push(`${relative}: operational environment file must not be published`);
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase()) && !entry.name.endsWith('.example')) continue;
    let text;
    try {
      text = fs.readFileSync(absolute, 'utf8');
    } catch {
      continue;
    }
    if (formerBrandPattern.test(text)) {
      failures.push(`${relative}: organization-specific brand residue remains`);
    }
    if (/(?:AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{25,}|sk-[A-Za-z0-9]{25,})/.test(text)) {
      failures.push(`${relative}: credential-like value detected; inspect locally without publishing it`);
    }
  }
};

for (const file of ['package.json', 'backend/package.json', 'frontend/package.json']) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  if (manifest.license !== 'MIT') failures.push(`${file}: expected MIT license metadata`);
}
for (const file of ['LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md']) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`${file}: required public file missing`);
}
if (!/MIT License/i.test(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'))) {
  failures.push('LICENSE: MIT license text not detected');
}
walk(root);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Public distribution checks passed.');
