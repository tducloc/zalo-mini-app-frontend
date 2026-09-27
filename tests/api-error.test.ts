import axios, { AxiosHeaders } from 'axios';

import { getApiErrorDetails, getApiErrorStatus } from '@/utils/api-error';

function apiError(status: number) {
  return new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: String(status),
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  });
}

describe('getApiErrorStatus', () => {
  it('reads the HTTP status, and nothing from a network error', () => {
    expect(getApiErrorStatus(apiError(409))).toBe(409);
    expect(getApiErrorStatus(new Error('offline'))).toBeUndefined();
  });
});

describe('getApiErrorDetails', () => {
  it('reads details from the error envelope, and nothing from anything else', () => {
    const withDetails = apiError(409);
    if (withDetails.response) {
      withDetails.response.data = { error: { code: 'CONFLICT', details: [{ mediaId: 'm1' }] } };
    }
    expect(getApiErrorDetails(withDetails)).toEqual([{ mediaId: 'm1' }]);
    expect(getApiErrorDetails(apiError(500))).toBeUndefined();
    expect(getApiErrorDetails(new Error('bug'))).toBeUndefined();
  });
});
