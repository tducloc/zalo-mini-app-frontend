import { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { restoreSession, settleAuthBootstrap } from '@/features/auth/api/session';
import { useAuthStore } from '@/stores/auth';

export function AuthBootstrap({ children }: PropsWithChildren) {
  const [busy, setBusy] = useState(false);

  const error = useAuthStore((state) => state.error);

  const setError = useAuthStore((state) => state.setError);

  const retry = useCallback(async () => {
    setBusy(true);
    try {
      await restoreSession(true);
    } catch {
      setError('Chưa thể xác thực. Bạn vẫn có thể xem tin.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession().then(
      () => settleAuthBootstrap(),
      () => {
        settleAuthBootstrap();
      },
    );
  }, []);

  return (
    <>
      {children}

      {error && (
        <div className="auth-retry-notice" role="status">
          <span>Chưa thể xác thực. Bạn vẫn có thể xem tin.</span>
          <button disabled={busy} onClick={retry}>
            {busy ? 'Đang thử…' : 'Thử lại'}
          </button>
        </div>
      )}
    </>
  );
}
