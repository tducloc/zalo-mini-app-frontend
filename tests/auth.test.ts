import axios, { type InternalAxiosRequestConfig } from 'axios';
vi.mock('zmp-sdk', () => ({ getAccessToken: vi.fn() }));
const session = { accessToken: 'jwt-new', user: { id: 'u1', name: null, avatarUrl: null } };
let http: any,
  apiClient: any,
  restoreSession: any,
  getSession: any,
  saveSession: any,
  getAccessToken: any;
const response = (config: any, status: number, data = {}) => {
  const result = { config, status, data, headers: {}, statusText: String(status) };
  if (status >= 400)
    throw new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, result);
  return result;
};
beforeEach(async () => {
  vi.resetModules();
  // Local .env files must not change test behavior.
  vi.stubEnv('VITE_DEV_ZALO_TOKEN', '');
  vi.stubGlobal('window', new EventTarget());
  ({ getAccessToken } = await import('zmp-sdk'));
  getAccessToken.mockReset().mockResolvedValue('zalo-token');
  ({ apiClient } = await import('@/lib/api-client'));
  ({ restoreSession } = await import('@/features/auth/api/session'));
  ({ http } = await import('@/lib/http'));
  ({ getSession, saveSession } = await import('@/lib/session.storage'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('keeps session in memory only', () => {
  saveSession(session);
  expect(getSession()).toEqual(session);
});
it('shares Zalo exchange for concurrent 401s', async () => {
  apiClient.defaults.adapter = async (c: any) => response(c, 200, { data: session });
  http.defaults.adapter = async (c: any) =>
    response(c, c.headers.Authorization === 'Bearer jwt-new' ? 200 : 401);
  await Promise.all(Array.from({ length: 5 }, () => http.get('/me')));
  expect(getAccessToken).toHaveBeenCalledTimes(1);
});
it('does not retry twice', async () => {
  apiClient.defaults.adapter = async (c: any) => response(c, 200, { data: session });
  const request = vi.fn(async (c: any) => response(c, 401));
  http.defaults.adapter = request;
  await expect(http.get('/me')).rejects.toBeDefined();
  expect(request).toHaveBeenCalledTimes(2);
});
it('rejects empty Zalo token and cools down', async () => {
  const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  getAccessToken.mockResolvedValueOnce('');
  await expect(restoreSession()).rejects.toThrow('Zalo');
  await expect(restoreSession()).rejects.toBeDefined();
  expect(getAccessToken).toHaveBeenCalledTimes(1);
  consoleInfo.mockRestore();
});
it('uses the dev Zalo token outside Zalo when one is configured', async () => {
  vi.stubEnv('VITE_DEV_ZALO_TOKEN', 'dev-token-for-local-browser');
  getAccessToken.mockResolvedValueOnce('DEFAULT ACCESS TOKEN');
  const exchange = vi.fn(async (c: InternalAxiosRequestConfig) =>
    response(c, 200, { data: session }),
  );
  apiClient.defaults.adapter = exchange;
  await expect(restoreSession()).resolves.toEqual(session);
  expect(JSON.parse(exchange.mock.calls[0][0].data)).toEqual({
    zaloAccessToken: 'dev-token-for-local-browser',
  });
});
it('keeps using the real Zalo token inside Zalo even with a dev token configured', async () => {
  vi.stubEnv('VITE_DEV_ZALO_TOKEN', 'dev-token-for-local-browser');
  const exchange = vi.fn(async (c: InternalAxiosRequestConfig) =>
    response(c, 200, { data: session }),
  );
  apiClient.defaults.adapter = exchange;
  await restoreSession();
  expect(JSON.parse(exchange.mock.calls[0][0].data)).toEqual({ zaloAccessToken: 'zalo-token' });
});
