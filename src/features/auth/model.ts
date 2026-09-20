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
