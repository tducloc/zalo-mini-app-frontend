/**
 * The step a lab test was on, kept across a crash. A crash takes the console with it, so
 * this is the only way to tell afterwards which step the app died in.
 *
 * localStorage, not sessionStorage: on Android a renderer crash starts a new WebView, and a
 * relaunch from Zalo starts a new session, either of which empties sessionStorage and would
 * make a crash look like a clean run. A finished test clears its breadcrumb.
 */
export function createStageBreadcrumb(key: string) {
  return {
    write(stage: string) {
      try {
        localStorage.setItem(key, `${stage} @ ${new Date().toLocaleTimeString()}`);
      } catch {
        // Storage blocked: the breadcrumb is a convenience, the test still runs.
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        // As above.
      }
    },
    /** The step a previous run never finished, or null. */
    read() {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
  };
}
