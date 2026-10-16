import { render, screen } from '@testing-library/react';

import { useMyPhoneNumber } from '@/features/contact/api/phone-number';
import SellerPermissionNotice from '@/features/contact/components/seller-permission-notice';
import {
  askMissingSellerPermissions,
  hasAskedSellerPermissions,
  readSellerPermissions,
  type PermissionAsk,
} from '@/features/contact/services/zalo-permissions';
import { useAuthStore } from '@/stores/auth';

vi.mock('zmp-sdk', () => ({}));
vi.mock('zmp-ui', () => ({ Icon: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({}) }));
vi.mock('@/features/contact/api/phone-number', () => ({
  useMyPhoneNumber: vi.fn(),
  useSharePhoneNumber: () => ({}),
}));
vi.mock('@/features/contact/services/zalo-permissions', () => ({
  hasAskedSellerPermissions: vi.fn(),
  markSellerPermissionsAsked: vi.fn(),
  readSellerPermissions: vi.fn(),
  askMissingSellerPermissions: vi.fn(),
}));

const NOTICE = { name: 'Hiển thị thông tin liên hệ' };
const NOTHING_SHARED = { name: false, phone: false };

function renderNotice(name: string | null, phoneNumber: string | null | undefined) {
  useAuthStore.getState().setSession({
    accessToken: 'token',
    user: { id: 'user_1', name, avatarUrl: null },
  });
  vi.mocked(useMyPhoneNumber).mockReturnValue({
    data: phoneNumber,
    isFetched: phoneNumber !== undefined,
  } as ReturnType<typeof useMyPhoneNumber>);
  render(<SellerPermissionNotice />);
}

describe('after the first visit asked already', () => {
  beforeEach(() => {
    vi.mocked(hasAskedSellerPermissions).mockReturnValue(true);
  });

  it.each([
    [null, null],
    ['Linh', null],
    [null, '0912345678'],
  ])(
    'asks to share while the name or the phone is missing (name %s, phone %s)',
    (name, phoneNumber) => {
      renderNotice(name, phoneNumber);

      expect(screen.getByRole('complementary', NOTICE)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Chia sẻ' })).toBeTruthy();
    },
  );

  it.each([
    ['Linh', '0912345678'],
    [null, undefined],
  ])('shows nothing once both are shared, or while the number loads', (name, phoneNumber) => {
    renderNotice(name, phoneNumber);

    expect(screen.queryByRole('complementary')).toBeNull();
  });
});

describe('on the first visit', () => {
  beforeEach(() => {
    vi.mocked(hasAskedSellerPermissions).mockReturnValue(false);
    vi.mocked(readSellerPermissions).mockResolvedValue(NOTHING_SHARED);
  });

  it("stays hidden while Zalo's sheet is open, then shows if the seller refused", async () => {
    let answer: (ask: PermissionAsk) => void = () => {};
    vi.mocked(askMissingSellerPermissions).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    renderNotice(null, null);
    await vi.waitFor(() => expect(askMissingSellerPermissions).toHaveBeenCalled());

    expect(screen.queryByRole('complementary')).toBeNull();

    answer({ outcome: 'refused', permissions: NOTHING_SHARED });

    expect(await screen.findByRole('complementary', NOTICE)).toBeTruthy();
  });

  it('shows the notice where the sheet cannot open (outside Zalo)', async () => {
    vi.mocked(readSellerPermissions).mockResolvedValue(null);

    renderNotice(null, null);

    expect(await screen.findByRole('complementary', NOTICE)).toBeTruthy();
  });
});
