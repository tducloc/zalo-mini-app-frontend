import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { readPostError } from '@/features/listings/api/create-listing';
import { PostErrorKind } from '@/features/listings/types/post-error';

// Only the error reading is tested; the request goes through the app's HTTP client.
vi.mock('@/lib/http', () => ({ http: {} }));

function apiError(status: number, details?: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('request failed', 'ERR_BAD_REQUEST', config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { error: { code: 'ANY', message: 'Any.', details } },
  });
}

describe('readPostError', () => {
  it('points at the form fields the server refused', () => {
    const error = apiError(400, [
      { field: 'price', message: 'Price must be greater than zero.' },
      { field: 'locationId', message: 'Unknown location.' },
    ]);
    expect(readPostError(error)).toEqual({
      kind: PostErrorKind.Fields,
      fields: ['price', 'locationId'],
    });
  });

  it('tells an error about what the app built apart from the fields', () => {
    expect(readPostError(apiError(400, [{ field: 'mediaIds' }])).kind).toBe(PostErrorKind.Invalid);
    expect(readPostError(apiError(400, [{ field: 'Idempotency-Key' }])).kind).toBe(
      PostErrorKind.Invalid,
    );
    expect(readPostError(apiError(400)).kind).toBe(PostErrorKind.Invalid);
  });

  it('tells a file the server cannot use apart (409)', () => {
    const error = apiError(409, [{ mediaId: 'm1', reason: 'ATTACHED' }]);
    expect(readPostError(error)).toEqual({ kind: PostErrorKind.MediaConflict });
  });

  it('gives the listing a reused key already made', () => {
    expect(readPostError(apiError(422, { productId: 'prd_1' }))).toEqual({
      kind: PostErrorKind.AlreadyPosted,
      productId: 'prd_1',
    });
  });

  it('reads every other failure as one case', () => {
    expect(readPostError(apiError(429)).kind).toBe(PostErrorKind.Other);
    expect(readPostError(apiError(500)).kind).toBe(PostErrorKind.Other);
    expect(readPostError(new AxiosError('Network Error', 'ERR_NETWORK')).kind).toBe(
      PostErrorKind.Other,
    );
    expect(readPostError(new Error('bug')).kind).toBe(PostErrorKind.Other);
    // An envelope the app does not expect is not trusted.
    expect(readPostError(apiError(422)).kind).toBe(PostErrorKind.Other);
  });
});
