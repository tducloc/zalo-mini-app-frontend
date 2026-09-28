import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { readPostError } from '@/features/listings/api/create-listing';
import { PostErrorKind } from '@/features/listings/types/post-error';
import { MediaError } from '@/features/media/types/upload';

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

  it('names the files the server cannot use (409), each with why', () => {
    const error = apiError(409, [
      { mediaId: 'm1', reason: 'ATTACHED' },
      { mediaId: 'm2', reason: 'NOT_FOUND' },
      { mediaId: 'm3', reason: 'UPLOADING' },
      { mediaId: 'm4', reason: 'FAILED', errorCode: 'VIDEO_TOO_LONG' },
      { mediaId: 'm5', reason: 'FAILED', errorCode: 'BLANK_IMAGE' },
    ]);
    expect(readPostError(error)).toEqual({
      kind: PostErrorKind.MediaConflict,
      media: [
        { mediaId: 'm1', error: MediaError.Missing },
        { mediaId: 'm2', error: MediaError.Missing },
        { mediaId: 'm3', error: MediaError.Missing },
        { mediaId: 'm4', error: MediaError.VideoTooLong },
        { mediaId: 'm5', error: MediaError.BlankImage },
      ],
    });
  });

  it('reads a FAILED without a code the app knows as a processing failure', () => {
    const error = apiError(409, [
      { mediaId: 'm1', reason: 'FAILED' },
      { mediaId: 'm2', reason: 'FAILED', errorCode: 'SOMETHING_NEW' },
      { mediaId: 'm3', reason: 'SOMETHING_NEW' },
    ]);
    expect(readPostError(error)).toEqual({
      kind: PostErrorKind.MediaConflict,
      media: [
        { mediaId: 'm1', error: MediaError.ProcessingFailed },
        { mediaId: 'm2', error: MediaError.ProcessingFailed },
        { mediaId: 'm3', error: MediaError.Missing },
      ],
    });
  });

  it('still reads a 409 whose details it cannot parse', () => {
    expect(readPostError(apiError(409, 'unexpected'))).toEqual({
      kind: PostErrorKind.MediaConflict,
      media: [],
    });
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
