import { create } from 'zustand';

import { Session } from '@/features/auth/model';

type AuthState = {
  session: Session | null;
  isBootstrapping: boolean;
  error: string | null;
  setSession: (session: Session) => void;
  clearSession: () => void;
  setBootstrapping: (isBootstrapping: boolean) => void;
  setError: (error: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isBootstrapping: true,
  error: null,
  setSession: (session) => set({ session, error: null }),
  clearSession: () => set({ session: null }),
  setBootstrapping: (isBootstrapping) => set({ isBootstrapping }),
  setError: (error) => set({ error }),
}));
