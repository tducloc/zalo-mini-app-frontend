import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import postcss from 'postcss';
import type { Plugin } from 'vite';

/**
 * zmp-ui components whose styles ship. zaui.css holds every component (121 KB); the app
 * uses these. The build fails when the bundle renders a zmp-ui component not listed here.
 */
const COMPONENTS_IN_USE = new Set([
  'app',
  'button',
  'header',
  'icon',
  'modal',
  'page',
  'progress',
  'router',
  'sheet',
  'snackbar-provider',
  'swiper',
]);

const ZMP_UI_DIR = fileURLToPath(new URL('../node_modules/zmp-ui/', import.meta.url));
const CLASS_ROOT = /\.zaui-([a-z]+)/g;

function classRoots(css: string) {
  return new Set([...css.matchAll(CLASS_ROOT)].map((match) => match[1]));
}

/** Class roots (`zaui-<root>…`) that only components outside COMPONENTS_IN_USE style. */
function unusedClassRoots() {
  const used = new Set<string>();
  const unused = new Set<string>();

  for (const component of readdirSync(ZMP_UI_DIR)) {
    const file = `${ZMP_UI_DIR}${component}/styles/${component}.css`;
    if (!existsSync(file)) {
      continue;
    }

    const target = COMPONENTS_IN_USE.has(component) ? used : unused;
    for (const root of classRoots(readFileSync(file, 'utf8'))) {
      target.add(root);
    }
  }

  return new Set([...unused].filter((root) => !used.has(root)));
}

function stripUnusedRules(css: string) {
  const unused = unusedClassRoots();
  const isLive = (selector: string) =>
    [...selector.matchAll(CLASS_ROOT)].every((match) => !unused.has(match[1]));

  const root = postcss.parse(css);
  root.walkRules((rule) => {
    const live = rule.selectors.filter(isLive);
    if (!live.length) {
      rule.remove();
    } else if (live.length < rule.selectors.length) {
      rule.selectors = live;
    }
  });
  root.walkAtRules((atRule) => {
    if (atRule.nodes?.length === 0) {
      atRule.remove();
    }
  });

  return root.toString();
}

export default function zauiCssSubset(): Plugin {
  return {
    name: 'zaui-css-subset',
    apply: 'build',
    transform(code, id) {
      if (!id.includes('zmp-ui/zaui.css')) {
        return null;
      }

      return stripUnusedRules(code);
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') {
          continue;
        }

        for (const [moduleId, module] of Object.entries(chunk.modules)) {
          const component = moduleId.match(/zmp-ui\/esm\/components\/([^/]+)\//)?.[1];
          if (component && module.renderedLength > 0 && !COMPONENTS_IN_USE.has(component)) {
            this.error(
              `zmp-ui "${component}" is in the bundle but its styles are stripped. Add it to COMPONENTS_IN_USE in vite-plugins/zaui-css-subset.ts.`,
            );
          }
        }
      }
    },
  };
}
