import { act, renderHook } from '@testing-library/react';

import { useAuthStore } from '@/stores/auth';

const refreshSellerProfile = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('zmp-sdk', () => ({}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ showError: vi.fn(), showInfo: vi.fn(), showSuccess: vi.fn() }),
}));
vi.mock('@/features/contact/api/phone-number', () => ({
  useMyPhoneNumber: () => ({ data: '0912345678', isFetched: true }),
  useSharePhoneNumber: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/features/contact/services/zalo-permissions', () => ({
  readSellerPermissions: async () => ({ name: false, phone: true }),
  askMissingSellerPermissions: async () => ({
    outcome: 'answered',
    permissions: { name: true, phone: true },
  }),
  hasAskedSellerPermissions: () => false,
  markSellerPermissionsAsked: () => undefined,
}));
vi.mock('@/features/auth/api/session', () => ({
  refreshSellerProfile,
}));

import { useShareSellerPermissions } from '@/features/contact/hooks/use-seller-permissions';

it('saves the name again when the seller allows it, even if the session still has the old one', async () => {
  vi.stubEnv('VITE_DEV_ZALO_TOKEN', '');
  // Zalo's revoke webhook cleared the name on the server; the session on the phone kept it.
  useAuthStore.getState().setSession({
    accessToken: 'token',
    user: { id: 'user_1', name: 'Linh', avatarUrl: null },
  });

  const { result } = renderHook(() => useShareSellerPermissions());
  await act(() => result.current.share());

  expect(refreshSellerProfile).toHaveBeenCalledTimes(1);
  vi.unstubAllEnvs();
});
