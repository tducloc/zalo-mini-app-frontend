import { resolve } from 'node:path';

import { build } from 'esbuild';
import type { Plugin } from 'vite';

const SUFFIX = '?worker-source';

/**
 * `import source from '@/…/image/worker.ts?worker-source'` gives that file bundled with its
 * imports into one minified classic script, as a string, to start a worker from a Blob URL.
 *
 * Why not a script URL: inside Zalo the app is served with `base: ''` from a custom origin,
 * so a worker URL never resolves. Vite's own `?worker&inline` makes a Blob only when
 * building; `zmp start` serves the worker from a URL and would break exactly where we test.
 * This plugin gives the same string in dev, in the build and in Vitest.
 */
export default function workerSource(): Plugin {
  return {
    name: 'worker-source',
    enforce: 'pre',
    async load(id) {
      if (!id.endsWith(SUFFIX)) {
        return null;
      }

      const result = await build({
        entryPoints: [id.slice(0, -SUFFIX.length)],
        bundle: true,
        format: 'iife',
        minify: true,
        target: 'es2020',
        write: false,
        metafile: true,
      });
      // Rebuild in dev when the worker or anything it imports changes.
      for (const input of Object.keys(result.metafile.inputs)) {
        this.addWatchFile(resolve(input));
      }
      return `export default ${JSON.stringify(result.outputFiles[0].text)};`;
    },
  };
}
