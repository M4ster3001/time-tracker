import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Inventory all installed lockfile components, including build tooling. This is
// intentionally an over-inclusive source inventory, not a claim that each one
// is bundled into the frontend. Retain native/Electron notices with those files.
export const collectThirdPartyNotices = (root = repoRoot) => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const components = [],
    texts = [];
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (!location.includes('node_modules/') || entry.link || !entry.version) continue;
    const folder = path.resolve(root, location);
    if (!fs.existsSync(folder)) continue; // platform-specific optional package
    const name = entry.name ?? location.split('node_modules/').pop();
    const licenses = fs
      .readdirSync(folder, { withFileTypes: true })
      .filter(
        (file) =>
          file.isFile() && /^(?:licen[sc]e|copying|notice|copyright)(?:[.-].*)?$/i.test(file.name)
      );
    components.push({
      name,
      version: entry.version,
      location,
      license: entry.license ?? 'NOASSERTION',
      development: Boolean(entry.dev),
      integrity: entry.integrity ?? null,
      noticeFiles: licenses.map((file) => file.name),
    });
    for (const file of licenses)
      texts.push(
        `===== ${name}@${entry.version} / ${file.name} =====\n${fs.readFileSync(path.join(folder, file.name), 'utf8')}`
      );
  }
  components.sort((a, b) => a.location.localeCompare(b.location));
  return {
    inventory:
      JSON.stringify(
        {
          format: 'time-tracker-source-inventory-v1',
          scope: 'Installed locked components including build tooling',
          components,
        },
        null,
        2
      ) + '\n',
    notices:
      'Third-party license texts retained from installed packages. Original terms apply.\n\n' +
      texts.join('\n\n') +
      '\n',
    sbom:
      JSON.stringify(
        {
          bomFormat: 'CycloneDX',
          specVersion: '1.6',
          version: 1,
          metadata: {
            component: { type: 'application', name: lock.name, version: lock.version },
            properties: [
              {
                name: 'time-tracker:scope',
                value:
                  'Over-inclusive installed source dependencies, including build tooling; not an artifact composition attestation',
              },
            ],
          },
          components: components.map((item) => ({
            type: 'library',
            name: item.name,
            version: item.version,
            'bom-ref': item.location,
            purl: `pkg:npm/${item.name.replace('@', '%40')}@${item.version}`,
            properties: [
              { name: 'time-tracker:development', value: String(item.development) },
              { name: 'time-tracker:declared-license', value: item.license },
              { name: 'time-tracker:lock-integrity', value: item.integrity ?? '' },
            ],
          })),
        },
        null,
        2
      ) + '\n',
  };
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.resolve(repoRoot, process.argv[2] ?? '.cache/release-notices');
  if (!output.startsWith(repoRoot + path.sep))
    throw new Error('Output must remain inside the workspace');
  const data = collectThirdPartyNotices();
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'DEPENDENCIES.json'), data.inventory);
  fs.writeFileSync(path.join(output, 'THIRD_PARTY_LICENSES.txt'), data.notices);
  fs.writeFileSync(path.join(output, 'source-sbom.cdx.json'), data.sbom);
  console.log('Source dependency inventory, notices and CycloneDX SBOM generated.');
}
