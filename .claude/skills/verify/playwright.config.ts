import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.VERIFY_BASE_URL;
const out = process.env.VERIFY_DRIVE_OUT;
if (!baseURL || !out) {
  throw new Error('Run drives through `.claude/skills/verify/scripts/verify drive <name>`.');
}

export default defineConfig({
  testDir: './drives',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: `${out}/report.json` }]],
  outputDir: `${out}/playwright`,
  use: {
    baseURL,
    trace: 'on',
    screenshot: 'on',
  },
  projects: [
    {
      name: 'chrome-375x812',
      use: { ...devices['Pixel 7'], channel: 'chrome', viewport: { width: 375, height: 812 } },
    },
  ],
});
