import { authorize, getSetting } from 'zmp-sdk';

import {
  askMissingSellerPermissions,
  hasAskedSellerPermissions,
  markSellerPermissionsAsked,
  readSellerPermissions,
} from '@/features/contact/services/zalo-permissions';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('zmp-sdk', () => ({
  authorize: vi.fn(),
  getSetting: vi.fn(),
  openPermissionSetting: vi.fn(),
  nativeStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  },
}));

beforeEach(() => {
  store.clear();
  vi.mocked(authorize).mockReset();
  vi.mocked(getSetting).mockReset();
});

it('reads each scope Zalo has already stored', async () => {
  vi.mocked(getSetting).mockResolvedValue({
    authSetting: { 'scope.userInfo': true, 'scope.userPhonenumber': false },
  });

  await expect(readSellerPermissions()).resolves.toEqual({ name: true, phone: false });
});

it('asks only for the scopes that are still off, and keeps a scope the seller turns off', async () => {
  vi.mocked(authorize).mockResolvedValue({
    'scope.userInfo': true,
    'scope.userPhonenumber': false,
  });

  await expect(askMissingSellerPermissions({ name: false, phone: false })).resolves.toEqual({
    outcome: 'answered',
    permissions: { name: true, phone: false },
  });
  expect(vi.mocked(authorize)).toHaveBeenCalledWith({
    scopes: ['scope.userInfo', 'scope.userPhonenumber'],
  });
});

it('does not open the sheet when both scopes are already on', async () => {
  await expect(askMissingSellerPermissions({ name: true, phone: true })).resolves.toEqual({
    outcome: 'ready',
    permissions: { name: true, phone: true },
  });
  expect(vi.mocked(authorize)).not.toHaveBeenCalled();
});

it('keeps the earlier reading when the seller refuses, and retries after any other error', async () => {
  vi.mocked(authorize).mockRejectedValueOnce({ code: -201 });
  await expect(askMissingSellerPermissions({ name: false, phone: true })).resolves.toEqual({
    outcome: 'refused',
    permissions: { name: false, phone: true },
  });

  vi.mocked(authorize).mockRejectedValueOnce(new Error('network'));
  await expect(askMissingSellerPermissions({ name: false, phone: true })).resolves.toEqual({
    outcome: 'failed',
    permissions: { name: false, phone: true },
  });
});

it('remembers that the sell page already asked', () => {
  expect(hasAskedSellerPermissions()).toBe(false);
  markSellerPermissionsAsked();
  expect(hasAskedSellerPermissions()).toBe(true);
});
