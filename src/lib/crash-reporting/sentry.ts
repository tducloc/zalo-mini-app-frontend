import {
  browserTracingIntegration,
  captureException,
  captureReactException,
  getClient,
  init,
  setUser,
  startBrowserTracingNavigationSpan,
} from '@sentry/react';

import type { SentryConfig } from '@/lib/crash-reporting/config';
import type { CrashReport, Reporter } from '@/lib/crash-reporting/index';
import type { Session } from '@/features/auth/types/session';
import { useAuthStore } from '@/stores/auth';

const routeSource = { 'sentry.source': 'route' } as const;

/** Loaded as its own chunk a few seconds after the load event (see `startCrashReporting`). */
export function initSentry(config: SentryConfig, firstRoute: string): Reporter {
  init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    // PII off: no IP address, cookies, headers, bodies or query strings (search text).
    // `identify` below sets the user ids by hand.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: config.tracesSampleRate,
    tracePropagationTargets: config.tracePropagationTargets,
    integrations: [
      browserTracingIntegration({
        // The app uses a memory router: the URL never changes, so the app reports each page.
        instrumentNavigation: false,
        beforeStartSpan: (options) =>
          options.op === 'pageload'
            ? {
                ...options,
                name: firstRoute,
                attributes: { ...options.attributes, ...routeSource },
              }
            : options,
      }),
    ],
  });

  identify(useAuthStore.getState().session);
  useAuthStore.subscribe((state, previous) => {
    if (state.session?.user.id !== previous.session?.user.id) {
      identify(state.session);
    }
  });

  return {
    capture: ({ error, source, componentStack }: CrashReport) => {
      if (source === 'react') {
        captureReactException(
          error,
          { componentStack },
          {
            mechanism: { type: 'auto.function.react.error_boundary', handled: true },
            captureContext: { contexts: { react: { componentStack } } },
          },
        );
      } else {
        captureException(error, {
          mechanism: { type: `auto.browser.global_handlers.${source}`, handled: false },
        });
      }
    },
    navigate: (route) => {
      const client = getClient();
      if (client) {
        startBrowserTracingNavigationSpan(client, { name: route, attributes: routeSource });
      }
    },
  };
}

/** Ids only: no name, avatar or phone number. */
function identify(session: Session | null) {
  setUser(session ? { id: session.user.id, zalo_id: session.user.zaloId } : null);
}
