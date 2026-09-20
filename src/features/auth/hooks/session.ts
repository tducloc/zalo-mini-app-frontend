import { useAuthStore } from '@/stores/auth';

export function useSession() {
  const session = useAuthStore((state) => state.session);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);

  return { session, isBootstrapping };
}
