/** Brand color backed by the `--marketplace-*-rgb` variables in src/css/app.scss. */
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
          "field-line": token("field-line"),
          tint: token("tint"),
          "tint-soft": token("tint-soft"),
          "tint-strong": token("tint-strong"),
          highlight: token("highlight"),
          pale: token("pale"),
          skeleton: token("skeleton"),
          danger: token("danger"),
          "danger-tint": token("danger-tint"),
        },
      },
      backgroundImage: {
        shimmer:
          "linear-gradient(110deg, rgb(var(--marketplace-skeleton-rgb)) 8%, rgb(var(--marketplace-surface-rgb)) 18%, rgb(var(--marketplace-skeleton-rgb)) 33%)",
      },
      keyframes: {
        shimmer: { to: { backgroundPosition: "-200% 0" } },
        "reel-loading": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(300%)" } },
        "hint-fade": { from: { opacity: "0" } },
        "hint-pop": { from: { opacity: "0", transform: "translateY(12px) scale(0.96)" } },
        "hint-finger-y": {
          "0%, 100%": { transform: "translateY(0)" },
          "25%, 35%": { transform: "translateY(-14px)" },
          "65%, 75%": { transform: "translateY(14px)" },
        },
        "hint-finger-x": {
          "0%, 15%, 100%": { transform: "translateX(0)" },
          "50%, 65%": { transform: "translateX(-24px)" },
        },
        "hint-finger-back": {
          "0%, 15%, 100%": { transform: "translateX(0)" },
          "50%, 65%": { transform: "translateX(24px)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s linear infinite",
        "reel-loading": "reel-loading 1.1s ease-in-out infinite",
        "hint-fade": "hint-fade 240ms ease-out",
        "hint-pop": "hint-pop 360ms cubic-bezier(0.2, 0.9, 0.3, 1.2)",
        "hint-finger-y": "hint-finger-y 1.8s ease-in-out infinite",
        "hint-finger-x": "hint-finger-x 1.8s ease-in-out infinite",
        "hint-finger-back": "hint-finger-back 1.8s ease-in-out infinite",
      },
    },
  },
};
