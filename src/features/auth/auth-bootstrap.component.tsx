import { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { restoreSession } from '@/features/auth/auth.api';

export function AuthBootstrap({ children }: PropsWithChildren) {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const retry = useCallback(async () => {
    setBusy(true);
    try {
      await restoreSession(true);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const onFailure = () => setFailed(true);
    const onSession = () => setFailed(false);

    window.addEventListener('auth:recovery-failed', onFailure);
    window.addEventListener('auth:session-changed', onSession);

    void restoreSession().catch(() => setFailed(true));

    return () => {
      window.removeEventListener('auth:recovery-failed', onFailure);
      window.removeEventListener('auth:session-changed', onSession);
    };
  }, []);

  return (
    <>
      {children}

      {failed && (
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
