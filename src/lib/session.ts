export interface SessionUser {
  id: string;
  zaloId?: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface Session {
  accessToken: string;
  user: SessionUser;
}

let currentSession: Session | null = null;

export function getSession(): Session | null {
  return currentSession;
}

export function saveSession(session: Session) {
  if (!session?.accessToken || !session.user?.id) {
    throw new Error('Phản hồi xác thực không hợp lệ.');
  }
  currentSession = session;
  window.dispatchEvent(new Event('auth:session-changed'));
}

export function clearSession() {
  currentSession = null;
  window.dispatchEvent(new Event('auth:session-changed'));
}
