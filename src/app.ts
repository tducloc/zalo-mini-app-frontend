// Missing built-ins on iOS 15.1–15.3; must run before anything else.
import '@/polyfills';
// Reads Zalo's build query before the router drops it.
import '@/lib/zalo-launch';
// Starts the feed request; Zalo usually ran it already as its own entry (vite.config.ts).
import '@/boot';

// ZaUI stylesheet
import 'zmp-ui/zaui.css';
// Tailwind stylesheet
import '@/css/tailwind.scss';
// Your stylesheet
import '@/css/app.scss';

// React core
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mount the app
import MyApp from '@/components/app';
import ErrorBoundary from '@/components/feedback/error-boundary';

// Expose app configuration
import appConfig from '../app-config.json';

// Sentry's start is a ~100 ms task. Started on the first tap or key, or after a while, it stays
// out of the app's opening; an error before that is not reported.
const SENTRY_START_DELAY_MS = 10_000;
const sentryStartEvents = ['pointerdown', 'keydown'] as const;
let sentryTimer = 0;
const startSentry = () => {
  window.clearTimeout(sentryTimer);
  for (const type of sentryStartEvents) {
    window.removeEventListener(type, startSentry, true);
  }
  void import('@/lib/sentry').then(({ initSentry }) => initSentry());
};
for (const type of sentryStartEvents) {
  window.addEventListener(type, startSentry, true);
}
sentryTimer = window.setTimeout(startSentry, SENTRY_START_DELAY_MS);

if (!window.APP_CONFIG) {
  window.APP_CONFIG = appConfig as any;
}

const root = createRoot(document.getElementById('app')!);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

root.render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(ErrorBoundary, { scope: 'app' }, React.createElement(MyApp)),
    ),
  ),
);
