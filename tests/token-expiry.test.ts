import { getTokenExpiryMs, hasLifetimeLeft } from '@/features/auth/utils/token-expiry';

const NOW_MS = 1_800_000_000_000;
const MINUTE_MS = 60_000;

function tokenWithPayload(payload: unknown) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

describe('getTokenExpiryMs', () => {
  it('reads exp, in seconds, as milliseconds', () => {
    expect(getTokenExpiryMs(tokenWithPayload({ exp: 1_800_000_060 }))).toBe(1_800_000_060_000);
  });

  it.each([
    ['not a string', 42],
    ['no dots', 'abc'],
    ['payload not base64 json', 'a.%%%.c'],
    ['payload not an object', tokenWithPayload(null)],
    ['no exp', tokenWithPayload({ sub: 'u1' })],
    ['exp as text', tokenWithPayload({ exp: '1800000060' })],
  ])('returns undefined when malformed: %s', (_name, token) => {
    expect(getTokenExpiryMs(token)).toBeUndefined();
  });
});

describe('hasLifetimeLeft', () => {
  const tokenExpiringIn = (ms: number) => tokenWithPayload({ exp: (NOW_MS + ms) / 1000 });

  it('is true only when more than the minimum is left', () => {
    expect(hasLifetimeLeft(tokenExpiringIn(MINUTE_MS + 1000), MINUTE_MS, NOW_MS)).toBe(true);
    expect(hasLifetimeLeft(tokenExpiringIn(MINUTE_MS), MINUTE_MS, NOW_MS)).toBe(false);
    expect(hasLifetimeLeft(tokenExpiringIn(-MINUTE_MS), MINUTE_MS, NOW_MS)).toBe(false);
  });

  it('is false for a malformed token', () => {
    expect(hasLifetimeLeft('nope', MINUTE_MS, NOW_MS)).toBe(false);
  });
});
