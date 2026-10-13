import { getAccessToken, getUserID } from 'zmp-sdk';

import { AUTH_ERROR_MESSAGE } from '@/features/auth/constants/auth';
import type { Session } from '@/features/auth/types/session';
import { resolveExchangeToken } from '@/features/auth/utils/exchange-token';
import { hasLifetimeLeft } from '@/features/auth/utils/token-expiry';
import { apiClient } from '@/lib/api-client';
import { readNativeCache, removeNativeCache, writeNativeCache } from '@/lib/native-cache';
import { useAuthStore } from '@/stores/auth';
import { warnInDev } from '@/utils/dev-log';

const SDK_TOKEN_TIMEOUT_MS = 15_000;
// Reusing a saved session must never hold up sign-in for long.
const SDK_USER_ID_TIMEOUT_MS = 3_000;
// A token about to expire would only fail on the first request.
const MIN_SAVED_TOKEN_LIFETIME_MS = 60_000;
const SESSION_CACHE_KEY = 'session';
const SESSION_CACHE_VERSION = 1;
// Automatic retries wait this long after a failure; a manual retry does not.
const RETRY_COOLDOWN_MS = 5_000;

let recoveryPromise: Promise<Session> | null = null;
let recoveryFailure: unknown;
let retryAfter = 0;

export function settleAuthBootstrap() {
  useAuthStore.getState().setBootstrapping(false);
}

/** The signed-in session, kept in memory only. */
export function getSession(): Session | null {
  return useAuthStore.getState().session;
}

function saveSession(session: Session) {
  if (!session?.accessToken || !session.user?.id) {
    throw new Error('Phản hồi xác thực không hợp lệ.');
  }
  useAuthStore.getState().setSession(session);
  writeNativeCache(SESSION_CACHE_KEY, session, SESSION_CACHE_VERSION);
}

/** Drop the saved session, as after a 401 shows that its token no longer works. */
export function discardSavedSession() {
  removeNativeCache(SESSION_CACHE_KEY);
}

function withTimeout<T>(start: () => Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

    start()
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

/** The SDK's Zalo access token, failing after a timeout instead of hanging. */
export function requestSdkToken() {
  return withTimeout(
    () => getAccessToken(),
    SDK_TOKEN_TIMEOUT_MS,
    'Zalo phản hồi chậm. Vui lòng thử lại.',
  );
}

/**
 * The session saved by an earlier app open, if its token is still good and Zalo reports the
 * same user. Any doubt returns undefined, so sign-in falls back to the normal exchange.
 */
async function readSavedSession(): Promise<Session | undefined> {
  const saved = readNativeCache<Session>(SESSION_CACHE_KEY, { version: SESSION_CACHE_VERSION });
  const savedZaloId = saved?.data.user?.zaloId;

  if (
    !saved ||
    !saved.data.user?.id ||
    !savedZaloId ||
    !hasLifetimeLeft(saved.data.accessToken, MIN_SAVED_TOKEN_LIFETIME_MS)
  ) {
    return undefined;
  }

  try {
    const zaloId = await withTimeout(
      () => getUserID(),
      SDK_USER_ID_TIMEOUT_MS,
      'Zalo phản hồi chậm.',
    );
    return zaloId === savedZaloId ? saved.data : undefined;
  } catch (error) {
    warnInDev('auth', 'saved session not reused', error);
    return undefined;
  }
}

async function exchangeForSession() {
  const sdkToken = await requestSdkToken();
  // Browser testing: the backend accepts this dev token outside production.
  const devToken = import.meta.env.DEV ? import.meta.env.VITE_DEV_ZALO_TOKEN : undefined;
  const zaloAccessToken = resolveExchangeToken(sdkToken, devToken);

  if (!zaloAccessToken) {
    throw new Error('Vui lòng mở Mini App trong Zalo để xác thực.');
  }

  const response = await apiClient.post<{ data: Session }>('/auth/zalo', { zaloAccessToken });
  return response.data.data;
}

async function loadSession() {
  return (await readSavedSession()) ?? (await exchangeForSession());
}

function handleRecoveryFailure(error: unknown): never {
  recoveryFailure = error;
  warnInDev('auth', 'session bootstrap failed', error);

  const message = error instanceof Error ? error.message : 'Unknown authentication error';
  const authError =
    import.meta.env.VITE_AUTH_DEBUG === 'true'
      ? `Chưa thể xác thực: ${message}`
      : AUTH_ERROR_MESSAGE;
  useAuthStore.getState().setError(authError);
  retryAfter = Date.now() + RETRY_COOLDOWN_MS;
  throw error;
}

// Bootstrap and concurrent 401s share one recovery; manual retry bypasses cooldown.
export function restoreSession(manualRetry = false): Promise<Session> {
  if (recoveryPromise) {
    return recoveryPromise;
  }

  if (!manualRetry && Date.now() < retryAfter) {
    return Promise.reject(recoveryFailure);
  }

  recoveryPromise = loadSession()
    .then((session) => {
      saveSession(session);
      useAuthStore.getState().setError(null);
      retryAfter = 0;
      return session;
    })
    .catch(handleRecoveryFailure)
    .finally(() => {
      recoveryPromise = null;
    });

  return recoveryPromise;
}

/**
 * Read the Zalo name again after the seller allows it. Unlike `restoreSession`, a failure
 * leaves the signed-in session and does not show the sign-in error.
 */
export async function refreshSellerProfile() {
  if (!getSession()) {
    return;
  }
  try {
    saveSession(await exchangeForSession());
  } catch (error) {
    warnInDev('auth', 'profile refresh failed', error);
  }
}
