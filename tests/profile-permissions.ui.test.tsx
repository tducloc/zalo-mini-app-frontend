import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openPermissionSetting } from 'zmp-sdk';

import { http } from '@/lib/http';
import ProfilePage from '@/pages/profile';
import { useAuthStore } from '@/stores/auth';

const resumeListeners = vi.hoisted(() => new Set<() => void>());

vi.mock('zmp-sdk', () => ({
  EventName: { AppResumed: 'h5.event.resumed' },
  events: { once: (_event: string, listener: () => void) => resumeListeners.add(listener) },
  openPermissionSetting: vi.fn(),
}));
vi.mock('zmp-ui', () => ({
  Button: () => null,
  Icon: () => null,
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useNavigate: () => vi.fn(),
}));
vi.mock('@/components/layout/mobile-page-header', () => ({ default: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({}) }));
vi.mock('@/lib/http', () => ({ http: { get: vi.fn() } }));

function serverUser(name: string | null, phoneNumber: string | null) {
  vi.mocked(http.get).mockResolvedValue({ data: { data: { name, avatarUrl: null, phoneNumber } } });
}

it('opens Zalo permissions, then shows what the server stores once the app resumes', async () => {
  useAuthStore.getState().setSession({
    accessToken: 'token',
    user: { id: 'user_1', name: 'Linh', avatarUrl: null },
  });
  serverUser('Linh', '0912345678');
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfilePage />
    </QueryClientProvider>,
  );

  await userEvent.click(await screen.findByRole('button', { name: 'Quản lý quyền' }));
  expect(openPermissionSetting).toHaveBeenCalled();

  serverUser(null, null);
  act(() => resumeListeners.forEach((listener) => listener()));

  expect(await screen.findByText('Kích hoạt tài khoản')).toBeTruthy();
  expect(screen.queryByText('Số điện thoại liên hệ')).toBeNull();
  expect(useAuthStore.getState().session?.user.name).toBeNull();
});
