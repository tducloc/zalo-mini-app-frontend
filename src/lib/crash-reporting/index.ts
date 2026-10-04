import { readSentryConfig, routeName, type SentryEnv } from '@/lib/crash-reporting/config';

declare global {
  interface Window {
    /** Set by the Zalo shell, e.g. "DEVELOPMENT" or "TESTING". */
    APP_ENV?: string;
  }
}

export type CrashReport = {
  error: unknown;
  source: 'onerror' | 'onunhandledrejection' | 'react';
  componentStack?: string;
};

export type Reporter = {
  capture: (report: CrashReport) => void;
  navigate: (route: string) => void;
};

/** Errors kept until Sentry loads. More than this in the first seconds are the same crash. */
const MAX_PENDING = 20;
/**
 * The load event comes before the feed and its first card image (the LCP), so Sentry waits
 * this long after it, then for an idle moment, to stay off their network and main thread.
 */
const LOAD_DELAY_MS = 3_000;
const IDLE_TIMEOUT_MS = 2_000;

let isOn = false;
let reporter: Reporter | null = null;
let pending: CrashReport[] = [];
let firstRoute: string | null = null;

const onError = (event: ErrorEvent) =>
  reportCrash({ error: event.error ?? event.message, source: 'onerror' });

const onRejection = (event: PromiseRejectionEvent) =>
  reportCrash({ error: event.reason, source: 'onunhandledrejection' });

/**
 * Catches errors from now on and loads Sentry a few seconds after the page loads, off the
 * first paint and the LCP.
 * Does nothing without `VITE_SENTRY_DSN`.
 */
export function startCrashReporting(
  env: SentryEnv,
  loadSentry: () => Promise<typeof import('@/lib/crash-reporting/sentry')>,
) {
  const config = readSentryConfig(env, window.APP_ENV);
  if (!config || isOn) {
    return;
  }

  isOn = true;
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  afterPageLoad(() => {
    loadSentry()
      .then(({ initSentry }) => {
        // Sentry's own handlers are on now.
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);

        reporter = initSentry(config, firstRoute ?? routeName(location.pathname));
        pending.forEach(reporter.capture);
        pending = [];
      })
      // A failed chunk must not break the app. The listeners keep buffering.
      .catch(() => undefined);
  });
}

export function reportCrash(report: CrashReport) {
  if (reporter) {
    reporter.capture(report);
  } else if (isOn && pending.length < MAX_PENDING) {
    pending.push(report);
  }
}

/** Names the performance trace after the page the user opened. */
export function reportRoute(pathname: string) {
  const route = routeName(pathname);
  if (firstRoute === null) {
    firstRoute = route;
  } else {
    reporter?.navigate(route);
  }
}

function afterPageLoad(run: () => void) {
  // iOS WebKit has no requestIdleCallback.
  const schedule = () =>
    setTimeout(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
      } else {
        run();
      }
    }, LOAD_DELAY_MS);

  if (document.readyState === 'complete') {
    schedule();
  } else {
    window.addEventListener('load', schedule, { once: true });
  }
}
