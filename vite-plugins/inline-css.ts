import type { Plugin } from 'vite';

/** Puts the built stylesheet in index.html so the first paint does not wait on a second file. */
export default function inlineCss(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) {
          return html;
        }

        const fileName = Object.keys(bundle).find((name) => name.endsWith('.css'));
        if (!fileName) {
          return html;
        }

        const asset = bundle[fileName];
        if (asset.type !== 'asset') {
          return html;
        }

        const css =
          typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source);
        const style = `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
        const link = new RegExp(`<link[^>]*${fileName.split('/').pop()}[^>]*>`);

        delete bundle[fileName];

        return html.replace(link, style);
      },
    },
  };
}
