import { init } from '@sentry/react';
import { afterEach, expect, it, vi } from 'vitest';

import { initSentry } from '@/lib/sentry';

vi.mock('@sentry/react', () => ({ init: vi.fn(), browserTracingIntegration: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(init).mockClear();
});

it('stays off without a DSN', () => {
  vi.stubEnv('VITE_SENTRY_DSN', '');

  initSentry();

  expect(init).not.toHaveBeenCalled();
});

it('starts with the DSN, the environment and a 10% trace rate by default', () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://public@o1.ingest.sentry.test/2');
  vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'testing');
  vi.stubEnv('VITE_SENTRY_TRACES_SAMPLE_RATE', '');

  initSentry();

  expect(init).toHaveBeenCalledWith(
    expect.objectContaining({
      dsn: 'https://public@o1.ingest.sentry.test/2',
      environment: 'testing',
      tracesSampleRate: 0.1,
    }),
  );
});
