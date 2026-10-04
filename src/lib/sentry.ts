import * as Sentry from '@sentry/react';

/** Does nothing without `VITE_SENTRY_DSN`, e.g. in local dev and tests. */
export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    // Zalo opens Testing and Development versions with `?env=TESTING` or `?env=DEVELOPMENT`.
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT ||
      new URLSearchParams(window.location.search).get('env')?.toLowerCase() ||
      import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
};
