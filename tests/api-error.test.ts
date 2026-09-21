import axios from 'axios';

import { getApiErrorStatus, resolveApiErrorMessage } from '../src/lib/api-error';

function apiError(status: number) {
  return new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: String(status),
    headers: {},
    config: { headers: {} },
    data: {},
  });
}

describe('API error messages', () => {
  const options = {
    fallbackMessage: 'Không thể thực hiện thao tác. Vui lòng thử lại.',
    messages: {
      401: 'Bạn cần xác thực lại.',
      409: 'Bạn đã thực hiện thao tác này trước đó.',
    },
  };

  it('maps configured HTTP statuses to a user-facing message', () => {
    expect(getApiErrorStatus(apiError(409))).toBe(409);
    expect(resolveApiErrorMessage(apiError(409), options)).toBe(
      'Bạn đã thực hiện thao tác này trước đó.',
    );
  });

  it('uses the fallback for network and unconfigured HTTP errors', () => {
    expect(resolveApiErrorMessage(new Error('offline'), options)).toBe(options.fallbackMessage);
    expect(resolveApiErrorMessage(apiError(500), options)).toBe(options.fallbackMessage);
  });
});
