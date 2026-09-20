import axios, { AxiosError } from 'axios';
import { restoreSession } from '@/features/auth/auth.api';
import { apiClient } from '@/lib/api-client';
import { getSession } from '@/lib/session.storage';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
    retriedAfterRefresh?: boolean;
    sessionUserId?: string;
  }
}

export const http = axios.create(apiClient.defaults);

http.interceptors.request.use((config) => {
  const session = getSession();
  if (session && !config.skipAuthRefresh) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
    config.sessionUserId = session.user.id;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config;
    if (
      error.response?.status !== 401 ||
      !request ||
      request.skipAuthRefresh ||
      request.retriedAfterRefresh
    ) {
      return Promise.reject(error);
    }
    request.retriedAfterRefresh = true;
    // Late responses can reuse a token renewed by another request.
    const current = getSession();
    const session =
      current && request.headers.Authorization !== `Bearer ${current.accessToken}`
        ? current
        : await restoreSession();
    if (request.signal?.aborted) throw new axios.CanceledError();
    if (request.sessionUserId && request.sessionUserId !== session.user.id) {
      throw new Error('Tài khoản đã thay đổi. Vui lòng thực hiện lại thao tác.');
    }
    request.headers.Authorization = `Bearer ${session.accessToken}`;
    return http(request);
  },
);
