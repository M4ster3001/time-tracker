// Gera os ícones da PWA a partir de um SVG desenhado inline (relógio / time tracker).
// Rode com: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'frontend', 'public');

const BRAND = '#0D7377';

// Desenho do relógio centralizado num viewBox 512x512.
const clock = (stroke) => `
  <circle cx="256" cy="256" r="150" fill="none" stroke="${stroke}" stroke-width="26"/>
  <line x1="256" y1="256" x2="256" y2="168" stroke="${stroke}" stroke-width="24" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="330" y2="256" stroke="${stroke}" stroke-width="24" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="18" fill="${stroke}"/>
`;

// Ícone "any": fundo azul com cantos arredondados.
const anySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BRAND}"/>
  ${clock('#ffffff')}
</svg>`;

// Ícone "maskable" / apple: fundo azul sangrando até a borda, relógio na zona segura.
const fullBleedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND}"/>
  <g transform="translate(256,256) scale(0.72) translate(-256,-256)">${clock('#ffffff')}</g>
</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

await mkdir(publicDir, { recursive: true });

await Promise.all([
  png(anySvg, 192).then((b) => writeFile(path.join(publicDir, 'pwa-192x192.png'), b)),
  png(anySvg, 512).then((b) => writeFile(path.join(publicDir, 'pwa-512x512.png'), b)),
  png(fullBleedSvg, 512).then((b) => writeFile(path.join(publicDir, 'pwa-maskable-512x512.png'), b)),
  png(fullBleedSvg, 180).then((b) => writeFile(path.join(publicDir, 'apple-touch-icon.png'), b)),
  writeFile(path.join(publicDir, 'favicon.svg'), anySvg),
]);

console.log('Ícones PWA gerados em frontend/public/');
