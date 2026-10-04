import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import zaloMiniApp from 'zmp-vite-plugin';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

import workerSource from './vite-plugins/worker-source';
import zauiFontDisplay from './vite-plugins/zaui-font-display';

// https://vitejs.dev/config/
export default () => {
  // Source maps are built only to upload them to Sentry, then deleted: Zalo never gets them.
  const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

  return defineConfig({
    root: '.',
    base: '',
    plugins: [
      workerSource(),
      zauiFontDisplay(),
      zaloMiniApp(),
      react(),
      uploadSourceMaps &&
        sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: { filesToDeleteAfterUpload: ['www/**/*.map'] },
          telemetry: false,
        }),
    ],
    build: {
      assetsInlineLimit: 0,
      // zmp-vite-plugin defaults to es2015, which cannot express BigInt literals
      // (used by mediabunny). Zalo needs iOS 15.1+ and Android WebView 119+, which all
      // run ES2020 (plans/create-listing.md, R6).
      target: 'es2020',
      sourcemap: uploadSourceMaps ? 'hidden' : false,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  });
};
