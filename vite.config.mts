import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import zaloMiniApp from 'zmp-vite-plugin';
import react from '@vitejs/plugin-react';

import workerSource from './vite-plugins/worker-source';

// https://vitejs.dev/config/
export default () => {
  return defineConfig({
    root: '.',
    base: '',
    plugins: [workerSource(), zaloMiniApp(), react()],
    build: {
      assetsInlineLimit: 0,
      // zmp-vite-plugin defaults to es2015, which cannot express BigInt literals
      // (used by mediabunny). Zalo needs iOS 15.1+ and Android WebView 119+, which all
      // run ES2020 (plans/create-listing.md, R6).
      target: 'es2020',
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  });
};
