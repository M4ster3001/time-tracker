import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { collectThirdPartyNotices } from '../scripts/third-party-notices.mjs';

export default defineConfig({
  cacheDir: path.resolve(import.meta.dirname, '../node_modules/.cache/vite-frontend'),
  plugins: [
    {
      name: 'time-tracker-legal-notices',
      apply: 'build',
      generateBundle() {
        const thirdParty = collectThirdPartyNotices();
        for (const [fileName, source] of [['DEPENDENCIES.json', thirdParty.inventory], ['THIRD_PARTY_LICENSES.txt', thirdParty.notices], ['source-sbom.cdx.json', thirdParty.sbom]]) {
          this.emitFile({ type: 'asset', fileName: `legal/${fileName}`, source });
        }
        for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
          this.emitFile({ type: 'asset', fileName: `legal/${file}`,
            source: readFileSync(path.resolve(import.meta.dirname, '..', file), 'utf8') });
        }
      },
    } satisfies Plugin,
    react(),
    VitePWA({
      // Local desktop builds can disable the web service worker when needed.
      disable: process.env.DESKTOP_BUILD === 'true',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Time Tracker',
        short_name: 'Time Tracker',
        description: 'Registro de horas, clientes e relatórios.',
        lang: 'pt-BR',
        theme_color: '#0D7377',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache apenas os assets estáticos do build (a API /api nunca é cacheada).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // SPA: rotas desconhecidas caem no index.html (a casca do app).
        navigateFallback: '/index.html',
        // Nunca interceptar chamadas de API com o fallback de navegação.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        // Desabilitado em dev para não interferir no HMR; habilite se quiser testar o SW localmente.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // 0.0.0.0: acesso via IP da LAN (ex. http://192.168.x.x:3000). IPs ja passam
    // no allowedHosts do Vite; o backend precisa de CORS_ORIGIN / CORS_ALLOW_PRIVATE_LAN.
    host: true,
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        // 127.0.0.1 avoids Windows localhost→::1 mismatch when API binds IPv4.
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    // PERF-04: Code-splitting for better caching and loading
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[/\\](?:react|react-dom|react-router|react-router-dom)[/\\]/.test(id)) return 'vendor-react';
          if (/[/\\](?:axios|zustand)[/\\]/.test(id)) return 'vendor-utils';
        },
      },
    },
  },
});
