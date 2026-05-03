import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the ai-workspace-lab e2e suite.
 *
 * Phase 0: no app under test yet. The smoke spec runs without a webServer.
 * When the first product app lands, set baseURL + uncomment webServer.
 */
const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: isCI ? [['html', { open: 'never' }], ['github']] : 'html',
  use: {
    // baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  // webServer: {
  //   command: 'pnpm --filter @ai-workspace-lab/web dev',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !isCI,
  //   timeout: 120_000,
  // },
});
