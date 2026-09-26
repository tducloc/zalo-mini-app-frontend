/** A warning in dev builds only; production users never see the console. */
export function warnInDev(scope: string, message: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.warn(`[${scope}] ${message}`, error);
  }
}
