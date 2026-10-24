import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  cacheDir: path.resolve(import.meta.dirname, '../node_modules/.cache/vitest-backend'),
  test: {
    globals: true,
    environment: 'node',
    ...(process.env.RUN_DB_INTEGRATION === 'true' ? { testTimeout: 60000, hookTimeout: 60000 } : {}),
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**/*.ts', 'src/shared/**/*.ts', 'src/modules/**/*.ts'],
      exclude: ['node_modules/', 'dist/', 'src/**/*.test.ts'],
      thresholds: {
        branches: 85,
        statements: 90,
        lines: 90,
        functions: 90,
      },
    },
  },
});
