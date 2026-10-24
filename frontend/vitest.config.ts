import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  cacheDir: path.resolve(import.meta.dirname, '../node_modules/.cache/vitest-frontend'),
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
});
