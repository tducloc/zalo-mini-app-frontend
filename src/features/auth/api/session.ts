import { getAccessToken } from 'zmp-sdk';

import { AUTH_ERROR_MESSAGE, ZALO_PLACEHOLDER_TOKEN } from '@/features/auth/constants/auth';
import type { Session } from '@/features/auth/types/session';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth';
import { warnInDev } from '@/utils/dev-log';

const SDK_TOKEN_TIMEOUT_MS = 15_000;
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
}

/** The SDK's Zalo access token, failing after a timeout instead of hanging. */
function requestSdkToken() {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Zalo phản hồi chậm. Vui lòng thử lại.')),
      SDK_TOKEN_TIMEOUT_MS,
    );

    getAccessToken()
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
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

  recoveryPromise = exchangeForSession()
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
