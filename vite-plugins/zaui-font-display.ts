import type { Plugin } from 'vite';

const FACE = 'font-family: "zaui-icons";\n  font-style: normal;';

/** Icon font blocks first paint while it downloads. Show the rest of the page immediately. */
export default function zauiFontDisplay(): Plugin {
  return {
    name: 'zaui-font-display',
    transform(code, id) {
      if (!id.includes('zaui.css') || code.includes('font-display') || !code.includes(FACE)) {
        return null;
      }

      return code.replace(FACE, `${FACE}\n  font-display: swap;`);
    },
  };
}
