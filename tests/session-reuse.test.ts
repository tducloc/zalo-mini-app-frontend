import axios from 'axios';

const store = vi.hoisted(() => new Map<string, string>());
const nativeStorage = vi.hoisted(() => ({
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
}));

vi.mock('zmp-sdk', () => ({ getAccessToken: vi.fn(), getUserID: vi.fn(), nativeStorage }));

const SESSION_KEY = 'session';
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const USER_ID_TIMEOUT_MS = 3_000;

function tokenExpiringIn(ms: number) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor((Date.now() + ms) / 1000);
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.signature`;
}

function sessionWith(accessToken: string, user: object = { zaloId: 'zalo-1' }) {
  return { accessToken, user: { id: 'u1', name: null, avatarUrl: null, ...user } };
}

function saveSessionOnDevice(session: unknown) {
  store.set(SESSION_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), data: session }));
}

function response(config: any, status: number, data = {}) {
  const result = { config, status, data, headers: {}, statusText: String(status) };
  if (status >= 400) {
    throw new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, result);
  }
  return result;
}

let http: any, apiClient: any, restoreSession: any, getSession: any;
let getAccessToken: any, getUserID: any;
let exchange: ReturnType<typeof vi.fn>;
const exchanged = sessionWith('jwt-exchanged');

beforeEach(async () => {
  store.clear();
  vi.resetModules();
  vi.stubEnv('VITE_DEV_ZALO_TOKEN', '');
  vi.stubGlobal('window', new EventTarget());
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  ({ getAccessToken, getUserID } = await import('zmp-sdk'));
  getAccessToken.mockReset().mockResolvedValue('zalo-token');
  getUserID.mockReset().mockResolvedValue('zalo-1');

  ({ apiClient } = await import('@/lib/api-client'));
  ({ restoreSession, getSession } = await import('@/features/auth/api/session'));
  ({ http } = await import('@/lib/http'));

  exchange = vi.fn(async (config: any) => response(config, 200, { data: exchanged }));
  apiClient.defaults.adapter = exchange;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('reopening the app with a saved session', () => {
  it('reuses a valid session of the same Zalo user without exchanging', async () => {
    const saved = sessionWith(tokenExpiringIn(HOUR_MS));
    saveSessionOnDevice(saved);

    await restoreSession();

    expect(getSession()).toEqual(saved);
    expect(exchange).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it('exchanges when the token has expired', async () => {
    saveSessionOnDevice(sessionWith(tokenExpiringIn(-MINUTE_MS)));

    await restoreSession();

    expect(exchange).toHaveBeenCalledTimes(1);
    expect(getSession()).toEqual(exchanged);
  });

  it('exchanges when the token expires within 60 seconds', async () => {
    saveSessionOnDevice(sessionWith(tokenExpiringIn(MINUTE_MS - 5000)));

    await restoreSession();

    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('exchanges when Zalo reports a different user', async () => {
    saveSessionOnDevice(sessionWith(tokenExpiringIn(HOUR_MS)));
    getUserID.mockResolvedValue('zalo-2');

    await restoreSession();

    expect(exchange).toHaveBeenCalledTimes(1);
    expect(getSession()).toEqual(exchanged);
  });

  it('exchanges when getUserID fails', async () => {
    saveSessionOnDevice(sessionWith(tokenExpiringIn(HOUR_MS)));
    getUserID.mockRejectedValue(new Error('-1404'));

    await restoreSession();

    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('exchanges when getUserID never answers', async () => {
    vi.useFakeTimers();
    saveSessionOnDevice(sessionWith(tokenExpiringIn(HOUR_MS)));
    getUserID.mockReturnValue(new Promise(() => undefined));

    const restoring = restoreSession();
    await vi.advanceTimersByTimeAsync(USER_ID_TIMEOUT_MS);
    await restoring;

    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('exchanges when the saved session has no Zalo id', async () => {
    saveSessionOnDevice(sessionWith(tokenExpiringIn(HOUR_MS), {}));

    await restoreSession();

    expect(getUserID).not.toHaveBeenCalled();
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['malformed token', sessionWith('not-a-jwt')],
    ['no user', { accessToken: tokenExpiringIn(HOUR_MS) }],
  ])('exchanges when the saved session has a %s', async (_name, saved) => {
    saveSessionOnDevice(saved);

    await restoreSession();

    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('saves every exchanged session for the next open', async () => {
    await restoreSession();

    expect(JSON.parse(store.get(SESSION_KEY) ?? 'null')).toMatchObject({ v: 1, data: exchanged });
  });
});

describe('a 401 on a saved session', () => {
  it('signs in again instead of reusing the saved token', async () => {
    const saved = sessionWith(tokenExpiringIn(HOUR_MS));
    saveSessionOnDevice(saved);
    await restoreSession();
    expect(exchange).not.toHaveBeenCalled();

    http.defaults.adapter = async (config: any) =>
      response(config, config.headers.Authorization === 'Bearer jwt-exchanged' ? 200 : 401);
    await http.get('/me');

    expect(exchange).toHaveBeenCalledTimes(1);
    expect(getSession()).toEqual(exchanged);
    expect(JSON.parse(store.get(SESSION_KEY) ?? 'null').data).toEqual(exchanged);
  });
});
