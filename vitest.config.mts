import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const sourceDirectory = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': sourceDirectory,
    },
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [['tests/**/*.ui.test.tsx', 'jsdom']],
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
