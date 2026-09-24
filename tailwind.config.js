/** Brand color backed by the `--marketplace-*-rgb` variables in app.scss. */
const token = (name) => `rgb(var(--marketplace-${name}-rgb) / <alpha-value>)`;

module.exports = {
  darkMode: ["selector", '[zaui-theme="dark"]'],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "!./src/www/**"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["Roboto Mono", "monospace"],
      },
      fontSize: {
        micro: "11px",
        caption: "13px",
      },
      colors: {
        marketplace: {
          blue: token("blue"),
          "blue-dark": token("blue-dark"),
          ink: token("ink"),
          muted: token("muted"),
          subtle: token("subtle"),
          surface: token("surface"),
          line: token("line"),
          tint: token("tint"),
          "tint-strong": token("tint-strong"),
          pale: token("pale"),
          skeleton: token("skeleton"),
          danger: token("danger"),
        },
      },
      backgroundImage: {
        shimmer:
          "linear-gradient(110deg, rgb(var(--marketplace-skeleton-rgb)) 8%, rgb(var(--marketplace-surface-rgb)) 18%, rgb(var(--marketplace-skeleton-rgb)) 33%)",
      },
      keyframes: {
        shimmer: { to: { backgroundPosition: "-200% 0" } },
      },
      animation: {
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
};
