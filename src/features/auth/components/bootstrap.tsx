import { PropsWithChildren, useEffect, useState } from 'react';

import { restoreSession, settleAuthBootstrap } from '@/features/auth/api/session';
import { useAuthStore } from '@/stores/auth';

import AuthRetryNotice from './auth-retry-notice';
import { AUTH_ERROR_MESSAGE } from '../constants';

/**
 * Signs in with Zalo in the background. Public screens (Home, detail) render
 * immediately; screens that need a session read `isBootstrapping` themselves
 * instead of the whole app waiting on the SDK and the token exchange.
 */
export function AuthBootstrap({ children }: PropsWithChildren) {
  const error = useAuthStore((state) => state.error);
  const setError = useAuthStore((state) => state.setError);

  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    void restoreSession().then(settleAuthBootstrap, settleAuthBootstrap);
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await restoreSession(true);
    } catch {
      setError(AUTH_ERROR_MESSAGE);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <>
      {children}

      {error && <AuthRetryNotice isRetrying={isRetrying} onRetry={handleRetry} />}
    </>
  );
}
