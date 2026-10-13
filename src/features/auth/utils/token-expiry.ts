const JWT_PARTS = 3;
const PAYLOAD_INDEX = 1;
const MS_PER_SECOND = 1000;

/** The `exp` claim of a JWT in milliseconds, read without verifying it; undefined if malformed. */
export function getTokenExpiryMs(token: unknown): number | undefined {
  if (typeof token !== 'string') {
    return undefined;
  }

  const parts = token.split('.');
  if (parts.length !== JWT_PARTS) {
    return undefined;
  }

  try {
    const base64 = parts[PAYLOAD_INDEX].replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(base64));
    const exp = (payload as { exp?: unknown } | null)?.exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * MS_PER_SECOND : undefined;
  } catch {
    return undefined;
  }
}

/** True when the token's own `exp` is more than `minLifetimeMs` away. */
export function hasLifetimeLeft(token: unknown, minLifetimeMs: number, nowMs = Date.now()) {
  const expiryMs = getTokenExpiryMs(token);
  return expiryMs !== undefined && expiryMs - nowMs > minLifetimeMs;
}
