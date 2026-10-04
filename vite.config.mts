import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import zaloMiniApp from 'zmp-vite-plugin';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

import workerSource from './vite-plugins/worker-source';
import zauiFontDisplay from './vite-plugins/zaui-font-display';

/** Tags Sentry events and names the uploaded source maps. */
function sentryRelease() {
  if (process.env.VITE_SENTRY_RELEASE) {
    return process.env.VITE_SENTRY_RELEASE;
  }

  try {
    return `marketplace-frontend@${execSync('git rev-parse --short HEAD').toString().trim()}`;
  } catch {
    return undefined;
  }
}

// https://vitejs.dev/config/
export default () => {
  const release = sentryRelease();
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
          release: { name: release },
          sourcemaps: { filesToDeleteAfterUpload: ['www/**/*.map'] },
          telemetry: false,
        }),
    ],
    define: {
      'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release ?? ''),
    },
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
