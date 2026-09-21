import { getAccessToken } from 'zmp-sdk';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/lib/api-client';
import { saveSession, Session } from '@/lib/session.storage';

let recoveryPromise: Promise<Session> | null = null;
let recoveryFailure: unknown;
let retryAfter = 0;
export function settleAuthBootstrap() {
  useAuthStore.getState().setBootstrapping(false);
}

// Bootstrap and concurrent 401s share one recovery; manual retry bypasses cooldown.
export function restoreSession(manualRetry = false): Promise<Session> {
  if (recoveryPromise) return recoveryPromise;
  if (!manualRetry && Date.now() < retryAfter) return Promise.reject(recoveryFailure);

  recoveryPromise = (async () => {
    let next: Session;
    {
      const zaloAccessToken = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Zalo phản hồi chậm. Vui lòng thử lại.')),
          15_000,
        );
        if (import.meta.env.DEV) console.info('[auth] Requesting Zalo access token');
        getAccessToken().then(
          (token) => {
            clearTimeout(timer);
            if (import.meta.env.DEV) {
              console.info('[auth] Zalo access token received', {
                isPlaceholder: token === 'DEFAULT ACCESS TOKEN',
                length: token?.length ?? 0,
              });
            }
            resolve(token);
          },
          (error) => {
            clearTimeout(timer);
            if (import.meta.env.DEV) console.error('[auth] getAccessToken rejected', error);
            reject(error);
          },
        );
      });
      if (!zaloAccessToken || zaloAccessToken === 'DEFAULT ACCESS TOKEN') {
        throw new Error('Vui lòng mở Mini App trong Zalo để xác thực.');
      }
      if (import.meta.env.DEV) console.info('[auth] Exchanging Zalo token with API');
      const response = await apiClient.post<{ data: Session }>('/auth/zalo', { zaloAccessToken });
      next = response.data.data;
    }
    saveSession(next);
    useAuthStore.getState().setError(null);
    retryAfter = 0;
    return next;
  })()
    .catch((error) => {
      recoveryFailure = error;
      if (import.meta.env.DEV) {
        console.error('[auth] Session bootstrap failed', error);
      }
      const message = error instanceof Error ? error.message : 'Unknown authentication error';
      const authError =
        import.meta.env.VITE_AUTH_DEBUG === 'true'
          ? `Chưa thể xác thực: ${message}`
          : 'Chưa thể xác thực. Bạn vẫn có thể xem tin.';
      useAuthStore.getState().setError(authError);
      retryAfter = Date.now() + 5_000;
      throw error;
    })
    .then(
      (session) => {
        recoveryPromise = null;
        return session;
      },
      (error) => {
        recoveryPromise = null;
        throw error;
      },
    );
  return recoveryPromise;
}
