// Missing built-ins on iOS 15.1–15.3; must run before anything else.
import '@/polyfills';

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

import type { ProductFeedPage } from '@/features/products/types/product';

// Expose app configuration
import appConfig from '../app-config.json';

// Zalo does not upload index.html, so the early feed request has to start here too.
const feedBase = import.meta.env.VITE_API_BASE_URL;
if (feedBase && !window.__feedPrefetch) {
  const url = `${feedBase.replace(/\/$/, '')}/products?sortBy=publishedAt&order=desc&limit=20`;
  window.__feedPrefetch = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error('feed');
      }
      return response.json();
    })
    .then((page: ProductFeedPage) => {
      const cards = page?.data ?? [];
      for (const [index, card] of cards.slice(0, 2).entries()) {
        if (!card?.thumbnailUrl) {
          continue;
        }
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = card.thumbnailUrl;
        if (index === 0) {
          link.fetchPriority = 'high';
        }
        document.head.appendChild(link);
      }
      return page;
    });
}

// Its own chunk, so Sentry does not slow down the first render.
void import('@/lib/sentry').then(({ initSentry }) => initSentry());

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
