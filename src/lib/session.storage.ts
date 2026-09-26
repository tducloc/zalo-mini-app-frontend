import type { Session } from '@/features/auth/types/session';
import { useAuthStore } from '@/stores/auth';

export function getSession(): Session | null {
  return useAuthStore.getState().session;
}

export function saveSession(session: Session) {
  if (!session?.accessToken || !session.user?.id) {
    throw new Error('Phản hồi xác thực không hợp lệ.');
  }
  useAuthStore.getState().setSession(session);
}

export function clearSession() {
  useAuthStore.getState().clearSession();
}
