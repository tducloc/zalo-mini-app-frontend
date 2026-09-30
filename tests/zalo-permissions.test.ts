import { authorize, getSetting } from 'zmp-sdk';

import {
  askMissingSellerPermissions,
  hasAskedSellerPermissions,
  markSellerPermissionsAsked,
  readSellerPermissions,
} from '@/features/contact/services/zalo-permissions';

vi.mock('zmp-sdk', () => ({
  authorize: vi.fn(),
  getSetting: vi.fn(),
  openPermissionSetting: vi.fn(),
}));

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    clear: () => store.clear(),
  });
  vi.mocked(authorize).mockReset();
  vi.mocked(getSetting).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    name: true,
    phone: false,
  });
  expect(vi.mocked(authorize)).toHaveBeenCalledWith({
    scopes: ['scope.userInfo', 'scope.userPhonenumber'],
  });
});

it('does not open the sheet when both scopes are already on', async () => {
  await expect(askMissingSellerPermissions({ name: true, phone: true })).resolves.toEqual({
    name: true,
    phone: true,
  });
  expect(vi.mocked(authorize)).not.toHaveBeenCalled();
});

it('keeps the earlier reading when the seller closes the sheet', async () => {
  vi.mocked(authorize).mockRejectedValue(new Error('denied'));

  await expect(askMissingSellerPermissions({ name: false, phone: true })).resolves.toEqual({
    name: false,
    phone: true,
  });
});

it('remembers that the sell page already asked', () => {
  expect(hasAskedSellerPermissions()).toBe(false);
  markSellerPermissionsAsked();
  expect(hasAskedSellerPermissions()).toBe(true);
});
