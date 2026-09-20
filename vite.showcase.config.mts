import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'rename-html',
      enforce: 'post',
      generateBundle(_, bundle) {
        // Vite will still output it matching the source name ('app.html')
        if (bundle['showcase.html']) {
          bundle['showcase.html'].fileName = 'index.html';
        }
      },
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: 'ui-review', rollupOptions: { input: 'showcase.html' } },
});
