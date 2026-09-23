import { getAccessToken } from 'zmp-sdk';

import { apiClient } from '@/lib/api-client';
import { saveSession, Session } from '@/lib/session.storage';
import { useAuthStore } from '@/stores/auth';

import { AUTH_ERROR_MESSAGE } from '../constants';
import { resolveExchangeToken, ZALO_PLACEHOLDER_TOKEN } from '../utils/exchange-token';

const SDK_TOKEN_TIMEOUT_MS = 15_000;
// Automatic retries wait this long after a failure; a manual retry does not.
const RETRY_COOLDOWN_MS = 5_000;

let recoveryPromise: Promise<Session> | null = null;
let recoveryFailure: unknown;
let retryAfter = 0;

export function settleAuthBootstrap() {
  useAuthStore.getState().setBootstrapping(false);
}

function debugLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.info('[auth]', ...args);
  }
}

/** The SDK's Zalo access token, failing after a timeout instead of hanging. */
function requestSdkToken() {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Zalo phản hồi chậm. Vui lòng thử lại.')),
      SDK_TOKEN_TIMEOUT_MS,
    );
    debugLog('Requesting Zalo access token');

    getAccessToken().then(
      (token) => {
        clearTimeout(timer);
        debugLog('Zalo access token received', {
          isPlaceholder: token === ZALO_PLACEHOLDER_TOKEN,
          length: token?.length ?? 0,
        });
        resolve(token);
      },
      (error) => {
        clearTimeout(timer);
        debugLog('getAccessToken rejected', error);
        reject(error);
      },
    );
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

  debugLog('Exchanging Zalo token with API');
  const response = await apiClient.post<{ data: Session }>('/auth/zalo', { zaloAccessToken });
  return response.data.data;
}

function handleRecoveryFailure(error: unknown): never {
  recoveryFailure = error;
  debugLog('Session bootstrap failed', error);

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
