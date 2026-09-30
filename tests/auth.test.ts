import axios from 'axios';
vi.mock('zmp-sdk', () => ({ getAccessToken: vi.fn() }));
const session = { accessToken: 'jwt-new', user: { id: 'u1', name: null, avatarUrl: null } };
let http: any, apiClient: any, restoreSession: any, getSession: any, getAccessToken: any;
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
  ({ restoreSession, getSession } = await import('@/features/auth/api/session'));
  ({ http } = await import('@/lib/http'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('keeps the restored session in memory', async () => {
  apiClient.defaults.adapter = async (c: any) => response(c, 200, { data: session });
  await restoreSession();
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
it('refreshes the name without showing the sign-in error', async () => {
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  apiClient.defaults.adapter = async (c: any) => response(c, 200, { data: session });
  await restoreSession();
  apiClient.defaults.adapter = async (c: any) => response(c, 500);
  const { refreshSellerProfile } = await import('@/features/auth/api/session');
  const { useAuthStore } = await import('@/stores/auth');
  await refreshSellerProfile();
  expect(getSession()).toEqual(session);
  expect(useAuthStore.getState().error).toBeNull();
  consoleWarn.mockRestore();
});
it('rejects empty Zalo token and cools down', async () => {
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  getAccessToken.mockResolvedValueOnce('');
  await expect(restoreSession()).rejects.toThrow('Zalo');
  await expect(restoreSession()).rejects.toBeDefined();
  expect(getAccessToken).toHaveBeenCalledTimes(1);
  consoleWarn.mockRestore();
});
