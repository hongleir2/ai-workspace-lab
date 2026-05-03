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
    // Prevent apps/web/src/lib/env.ts from throwing at import time in tests.
    // Tests that need real env values should set them explicitly in the test.
    env: {
      SKIP_ENV_VALIDATION: '1',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
    include: ['packages/*/src/**/*.{test,spec}.ts', 'apps/*/src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
