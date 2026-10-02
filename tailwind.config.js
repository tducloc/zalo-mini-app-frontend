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
        "hint-feed": {
          "0%, 8%": { transform: "translateY(0)" },
          "35%": { transform: "translateY(-54%)" },
          "40%, 58%": { transform: "translateY(-50%)" },
          "85%": { transform: "translateY(4%)" },
          "90%, 100%": { transform: "translateY(0)" },
        },
        "hint-finger-y": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "8%": { transform: "translateY(8px)", opacity: "1" },
          "35%": { transform: "translateY(-10px)", opacity: "1" },
          "45%, 50%": { transform: "translateY(-10px)", opacity: "0" },
          "58%": { transform: "translateY(-10px)", opacity: "1" },
          "85%": { transform: "translateY(8px)", opacity: "1" },
          "95%, 100%": { transform: "translateY(8px)", opacity: "0" },
        },
        "hint-finger-x": {
          "0%": { transform: "translateX(4px)", opacity: "0" },
          "12%": { transform: "translateX(4px)", opacity: "1" },
          "50%": { transform: "translateX(-26px)", opacity: "1" },
          "62%, 100%": { transform: "translateX(-26px)", opacity: "0" },
        },
        "hint-reveal": {
          "0%, 12%": { transform: "translateX(100%)", opacity: "1" },
          "50%": { transform: "translateX(-4%)", opacity: "1" },
          "56%, 82%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(0)", opacity: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s linear infinite",
        "reel-loading": "reel-loading 1.1s ease-in-out infinite",
        "hint-fade": "hint-fade 240ms ease-out",
        "hint-pop": "hint-pop 360ms cubic-bezier(0.2, 0.9, 0.3, 1.2)",
        "hint-feed": "hint-feed 3.2s ease-in-out infinite",
        "hint-finger-y": "hint-finger-y 3.2s ease-in-out infinite",
        "hint-finger-x": "hint-finger-x 2.8s ease-in-out infinite",
        "hint-reveal": "hint-reveal 2.8s ease-in-out infinite",
      },
    },
  },
};
