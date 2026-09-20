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

// Expose app configuration
import appConfig from '../app-config.json';

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
    React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(MyApp)),
  ),
);
