import { getAccessToken } from 'zmp-sdk';
import { apiClient } from '@/lib/api-client';
import { saveSession, Session } from '@/lib/session.storage';

let recoveryPromise: Promise<Session> | null = null;
let recoveryFailure: unknown;
let retryAfter = 0;

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
        getAccessToken().then(
          (token) => {
            clearTimeout(timer);
            resolve(token);
          },
          (error) => {
            clearTimeout(timer);
            reject(error);
          },
        );
      });
      if (!zaloAccessToken || zaloAccessToken === 'DEFAULT ACCESS TOKEN') {
        throw new Error('Vui lòng mở Mini App trong Zalo để xác thực.');
      }
      const response = await apiClient.post<{ data: Session }>('/auth/zalo', { zaloAccessToken });
      next = response.data.data;
    }
    saveSession(next);
    retryAfter = 0;
    return next;
  })()
    .catch((error) => {
      recoveryFailure = error;
      retryAfter = Date.now() + 5_000;
      window.dispatchEvent(new Event('auth:recovery-failed'));
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
