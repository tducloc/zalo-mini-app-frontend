import { ZALO_PLACEHOLDER_TOKEN, resolveExchangeToken } from '@/features/auth/utils/exchange-token';

describe('resolveExchangeToken', () => {
  it('uses the SDK token inside Zalo, even when a dev token is configured', () => {
    expect(resolveExchangeToken('zalo-token', 'dev-token')).toBe('zalo-token');
  });

  it('uses the dev token outside Zalo', () => {
    expect(resolveExchangeToken(ZALO_PLACEHOLDER_TOKEN, 'dev-token')).toBe('dev-token');
    expect(resolveExchangeToken('', 'dev-token')).toBe('dev-token');
  });

  it('has nothing to exchange outside Zalo without a dev token', () => {
    expect(resolveExchangeToken(ZALO_PLACEHOLDER_TOKEN, undefined)).toBeNull();
    expect(resolveExchangeToken(undefined, '')).toBeNull();
  });
});
