import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // apps/web uses '@/' as a path alias for its src/ directory.
    // Without this, the root Vitest runner cannot resolve @/ imports in web tests.
    alias: {
      '@/': `${path.resolve(__dirname, 'apps/web/src')}/`,
    },
  },
  test: {
    include: ['packages/*/src/**/*.{test,spec}.ts', 'apps/*/src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
