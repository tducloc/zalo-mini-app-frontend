import axios from 'axios';
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
  vi.stubGlobal('window', new EventTarget());
  ({ getAccessToken } = await import('zmp-sdk'));
  getAccessToken.mockReset().mockResolvedValue('zalo-token');
  ({ apiClient } = await import('../src/lib/api-client'));
  ({ restoreSession } = await import('../src/features/auth/api/session'));
  ({ http } = await import('../src/lib/http'));
  ({ getSession, saveSession } = await import('../src/lib/session.storage'));
});
afterEach(() => vi.unstubAllGlobals());
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
  getAccessToken.mockResolvedValueOnce('');
  await expect(restoreSession()).rejects.toThrow('Zalo');
  await expect(restoreSession()).rejects.toBeDefined();
  expect(getAccessToken).toHaveBeenCalledTimes(1);
});
