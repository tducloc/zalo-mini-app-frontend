import { getAuthStatusLabel } from '@/features/auth/utils/auth-status';

describe('getAuthStatusLabel', () => {
  it('describes the three sign-in states', () => {
    expect(getAuthStatusLabel({ isSignedIn: true, isBootstrapping: false })).toBe(
      'Đã xác thực với Zalo',
    );
    expect(getAuthStatusLabel({ isSignedIn: false, isBootstrapping: true })).toBe(
      'Đang xác thực với Zalo…',
    );
    expect(getAuthStatusLabel({ isSignedIn: false, isBootstrapping: false })).toBe(
      'Chưa thể xác thực trong trình duyệt',
    );
  });

  it('prefers the signed-in state even while a retry is running', () => {
    expect(getAuthStatusLabel({ isSignedIn: true, isBootstrapping: true })).toBe(
      'Đã xác thực với Zalo',
    );
  });
});
