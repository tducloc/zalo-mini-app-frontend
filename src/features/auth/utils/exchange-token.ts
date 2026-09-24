// What the SDK returns outside Zalo (desktop browser, simulator).
export const ZALO_PLACEHOLDER_TOKEN = 'DEFAULT ACCESS TOKEN';

/**
 * The Zalo token to exchange at `POST /auth/zalo`: the SDK token inside Zalo,
 * the dev token outside it (dev builds only), or null when there is neither.
 */
export function resolveExchangeToken(sdkToken: string | undefined, devToken: string | undefined) {
  const isOutsideZalo = !sdkToken || sdkToken === ZALO_PLACEHOLDER_TOKEN;

  if (!isOutsideZalo) {
    return sdkToken;
  }

  return devToken || null;
}
