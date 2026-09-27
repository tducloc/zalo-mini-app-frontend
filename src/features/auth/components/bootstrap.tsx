import { PropsWithChildren, useEffect, useState } from 'react';

import { restoreSession, settleAuthBootstrap } from '@/features/auth/api/session';
import AuthRetryNotice from '@/features/auth/components/auth-retry-notice';
import { useAuthStore } from '@/stores/auth';

/**
 * Signs in with Zalo in the background. Public screens (Home, detail) render
 * immediately; screens that need a session read `isBootstrapping` themselves
 * instead of the whole app waiting on the SDK and the token exchange.
 */
export function AuthBootstrap({ children }: PropsWithChildren) {
  const error = useAuthStore((state) => state.error);

  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    void restoreSession().then(settleAuthBootstrap, settleAuthBootstrap);
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);

    // A failure has already put its error in the store, which keeps the notice up.
    const stopRetrying = () => setIsRetrying(false);
    void restoreSession(true).then(stopRetrying, stopRetrying);
  };

  return (
    <>
      {children}

      {error && <AuthRetryNotice isRetrying={isRetrying} onRetry={handleRetry} />}
    </>
  );
}
