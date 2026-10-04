import { startCrashReporting } from '@/lib/crash-reporting';

// app.ts imports this right after the polyfills, so errors thrown while the other modules
// load are caught too. A build without a DSN drops this branch and never emits Sentry.
// Each variable is named: passing `import.meta.env` whole would inline every VITE_ variable.
if (import.meta.env.VITE_SENTRY_DSN) {
  startCrashReporting(
    {
      DEV: import.meta.env.DEV,
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
      VITE_SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT,
      VITE_SENTRY_RELEASE: import.meta.env.VITE_SENTRY_RELEASE,
      VITE_SENTRY_TRACES_SAMPLE_RATE: import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
      VITE_SENTRY_TRACE_PROPAGATION: import.meta.env.VITE_SENTRY_TRACE_PROPAGATION,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    },
    () => import('@/lib/crash-reporting/sentry'),
  );
}
