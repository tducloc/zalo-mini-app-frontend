import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getSetting, openPermissionSetting } from 'zmp-sdk';

import { http } from '@/lib/http';
import ProfilePage from '@/pages/profile';
import { useAuthStore } from '@/stores/auth';

const resumeListeners = vi.hoisted(() => new Set<() => void>());

vi.mock('zmp-sdk', () => ({
  EventName: { AppResumed: 'h5.event.resumed' },
  events: { once: (_event: string, listener: () => void) => resumeListeners.add(listener) },
  getSetting: vi.fn(),
  openPermissionSetting: vi.fn(() => Promise.resolve()),
}));
vi.mock('zmp-ui', () => ({
  Button: () => null,
  Icon: () => null,
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useNavigate: () => vi.fn(),
}));
vi.mock('@/components/layout/mobile-page-header', () => ({ default: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({}) }));
vi.mock('@/lib/http', () => ({ http: { get: vi.fn(), delete: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  resumeListeners.clear();
});

function mockMe(name: string | null, phoneNumber: string | null) {
  vi.mocked(http.get).mockResolvedValue({ data: { data: { name, avatarUrl: null, phoneNumber } } });
}

async function returnFromZaloPermissions(name: string | null, phoneNumber: string | null) {
  useAuthStore.getState().setSession({
    accessToken: 'token',
    user: { id: 'user_1', name: 'Linh', avatarUrl: null },
  });
  mockMe('Linh', '0912345678');
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfilePage />
    </QueryClientProvider>,
  );

  await userEvent.click(await screen.findByRole('button', { name: 'Quản lý quyền' }));
  expect(openPermissionSetting).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Số điện thoại liên hệ')).toBeTruthy();

  mockMe(name, phoneNumber);
  act(() => resumeListeners.forEach((listener) => listener()));
}

it('asks to activate again once the server no longer has the name', async () => {
  await returnFromZaloPermissions(null, '0912345678');

  expect(await screen.findByText('Kích hoạt tài khoản')).toBeTruthy();
  expect(screen.getByText('Số điện thoại liên hệ')).toBeTruthy();
});

it('drops the phone card once the server no longer has the number', async () => {
  await returnFromZaloPermissions('Linh', null);

  await waitFor(() => expect(screen.queryByText('Số điện thoại liên hệ')).toBeNull());
  expect(screen.getByText('Kích hoạt tài khoản')).toBeTruthy();
});

it('drops the number on the server when the phone permission is now off in Zalo', async () => {
  vi.mocked(getSetting).mockResolvedValue({
    authSetting: { 'scope.userInfo': true, 'scope.userPhonenumber': false },
  } as never);
  await returnFromZaloPermissions('Linh', null);

  await waitFor(() => expect(screen.queryByText('Số điện thoại liên hệ')).toBeNull());
  expect(vi.mocked(http.delete).mock.calls).toEqual([['/me/phone-number']]);
});

it('offers "Quản lý quyền" only once the name or the number is shared', async () => {
  useAuthStore.getState().setSession({
    accessToken: 'token',
    user: { id: 'user_1', name: null, avatarUrl: null },
  });
  mockMe(null, null);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfilePage />
    </QueryClientProvider>,
  );

  expect(await screen.findByText('Kích hoạt tài khoản')).toBeTruthy();
  await waitFor(() => expect(http.get).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: 'Quản lý quyền' })).toBeNull();
});
