const MS_PER_SECOND = 1000;

/** True when the JWT's own `exp`, read without verifying it, is more than `minLifetimeMs` away. */
export function hasLifetimeLeft(token: unknown, minLifetimeMs: number) {
  if (typeof token !== 'string') {
    return false;
  }

  try {
    const [, payload] = token.split('.');
    const { exp }: { exp?: unknown } = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    );
    return typeof exp === 'number' && exp * MS_PER_SECOND - Date.now() > minLifetimeMs;
  } catch {
    return false;
  }
}
