import { render, screen } from '@testing-library/react';

import { useMyPhoneNumber } from '@/features/contact/api/phone-number';
import SellerPermissionNotice from '@/features/contact/components/seller-permission-notice';
import { useAuthStore } from '@/stores/auth';

vi.mock('zmp-sdk', () => ({}));
vi.mock('zmp-ui', () => ({ Icon: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({}) }));
vi.mock('@/features/contact/api/phone-number', () => ({
  useMyPhoneNumber: vi.fn(),
  useSharePhoneNumber: () => ({}),
}));

function renderNotice(name: string | null, phoneNumber: string | null | undefined) {
  useAuthStore.getState().setSession({
    accessToken: 'token',
    user: { id: 'user_1', name, avatarUrl: null },
  });
  vi.mocked(useMyPhoneNumber).mockReturnValue({ data: phoneNumber } as ReturnType<
    typeof useMyPhoneNumber
  >);
  render(<SellerPermissionNotice />);
}

it.each([
  [null, null, 'Bạn chưa chia sẻ tên và số điện thoại'],
  ['Linh', null, 'Bạn chưa chia sẻ số điện thoại'],
  [null, '0912345678', 'Bạn chưa chia sẻ tên Zalo'],
])('names what the seller has not shared (name %s, phone %s)', (name, phoneNumber, title) => {
  renderNotice(name, phoneNumber);

  expect(screen.getByRole('complementary', { name: title })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Chia sẻ' })).toBeTruthy();
});

it.each([
  ['Linh', '0912345678'],
  [null, undefined],
])('shows nothing once both are shared, or while the number loads', (name, phoneNumber) => {
  renderNotice(name, phoneNumber);

  expect(screen.queryByRole('complementary')).toBeNull();
});
