import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real local stack, started beforehand (see .claude/launch.json):
 * the frontend on 3100 (`frontend-local-api`, signs in with VITE_DEV_ZALO_TOKEN), the API on
 * 3002, the media worker (`node dist/src/worker/main.js` in backend/) and Floci for storage.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'android-chromium', use: { ...devices['Pixel 7'] } }],
});
