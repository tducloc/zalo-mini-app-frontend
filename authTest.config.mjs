// Reuse the workspace backend's Vitest runner: ../backend/node_modules/.bin/vitest run --config authTest.config.mjs
export default {
  root: new URL('.', import.meta.url).pathname,
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: { globals: true, environment: 'node', include: ['tests/*.test.ts'] },
};
