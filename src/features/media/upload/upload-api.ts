/**
 * The HTTP calls of uploads: the media endpoints (api-spec.md, "Media") and the presigned
 * PUT to storage. Every call an upload retries turns a failure into an UploadFailure, so
 * the retry rules see one kind of error whatever went wrong; `deleteMedia` is best effort
 * and throws the plain axios error.
 */

import axios from 'axios';

import { http } from '@/lib/http';
import type { PutOptions } from '@/features/media/upload/file-upload';
import {
  failureFromApiStatus,
  failureFromStorageStatus,
  FailureKind,
  UploadFailure,
} from '@/features/media/upload/retry-policy';
import { getApiErrorStatus } from '@/utils/api-error';
import type {
  CompletedPart,
  MediaStatusItem,
  RegisteredUpload,
  ServerMediaStatus,
  UploadRequestFile,
  UploadTarget,
} from '@/features/media/upload/upload-types';

const mediaPath = (mediaId: string) => `/media/${encodeURIComponent(mediaId)}`;

/** The response's `data`, or an UploadFailure; 0 stands for "no answer". */
async function requestData<T>(request: () => Promise<{ data: { data: T } }>) {
  try {
    return (await request()).data.data;
  } catch (error) {
    if (axios.isCancel(error)) {
      throw error;
    }
    throw new UploadFailure(failureFromApiStatus(getApiErrorStatus(error) ?? 0), error);
  }
}

/**
 * Not abortable on purpose: the server may create the media before a cancelled request
 * would be dropped, and the caller needs its ID to delete it. The endpoint takes up to 11
 * files; the app sends one at a time.
 */
export function registerUploads(files: UploadRequestFile[]) {
  return requestData(() =>
    http.post<{ data: { uploads: RegisteredUpload[] } }>('/media/upload-urls', { files }),
  ).then((data) => data.uploads);
}

/** Fresh URLs for a file still uploading; for a video, only `partNumbers` when given. */
export function refreshUploadUrl(mediaId: string, partNumbers?: number[], signal?: AbortSignal) {
  return requestData(() =>
    http.post<{ data: UploadTarget }>(
      `${mediaPath(mediaId)}/upload-url`,
      { partNumbers },
      { signal },
    ),
  );
}

export function completeParts(mediaId: string, parts: CompletedPart[], signal?: AbortSignal) {
  return requestData(() =>
    http.post<{ data: { status: ServerMediaStatus } }>(
      `${mediaPath(mediaId)}/parts/complete`,
      { parts },
      { signal },
    ),
  ).then((data) => data.status);
}

export function completeUpload(mediaId: string, signal?: AbortSignal) {
  return requestData(() =>
    http.post<{ data: { status: ServerMediaStatus } }>(
      `${mediaPath(mediaId)}/complete`,
      undefined,
      { signal },
    ),
  ).then((data) => data.status);
}

/** Statuses of the caller's media; an ID the server no longer has is left out. */
export function fetchMediaStatuses(mediaIds: string[]) {
  return requestData(() =>
    http.get<{ data: MediaStatusItem[] }>('/media', { params: { ids: mediaIds.join(',') } }),
  );
}

export function deleteMedia(mediaId: string) {
  return http.delete(mediaPath(mediaId));
}

// ---- Storage ----

/**
 * No byte sent for this long means the connection is dead even if the socket is not: a
 * weak signal can stall a request for minutes. A whole-request timeout would instead cut
 * off a slow but moving 8 MB part.
 */
const STALL_TIMEOUT_MS = 30_000;
/**
 * Once the last byte is sent no progress comes: this long for storage's answer, so a PUT
 * that got through is not cut off while S3 writes it.
 */
const RESPONSE_TIMEOUT_MS = 60_000;

/**
 * One presigned PUT, with the plain axios instance: the URL carries its own signature and
 * must not get the API's Authorization header. axios reports upload progress (fetch
 * cannot). Resolves with the ETag storage gave the object or part, null when CORS hides it.
 */
export async function putBlob(
  url: string,
  body: Blob,
  { contentType, onProgress, signal }: PutOptions,
) {
  const controller = new AbortController();
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let hasStalled = false;
  const watchForStall = (timeoutMs: number) => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      hasStalled = true;
      controller.abort();
    }, timeoutMs);
  };
  const stop = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', stop);

  try {
    signal?.throwIfAborted();
    watchForStall(STALL_TIMEOUT_MS);
    const response = await axios.put(url, body, {
      headers: contentType ? { 'Content-Type': contentType } : {},
      signal: controller.signal,
      onUploadProgress: ({ loaded, total }) => {
        watchForStall(loaded === total ? RESPONSE_TIMEOUT_MS : STALL_TIMEOUT_MS);
        onProgress?.(loaded);
      },
    });
    const etag: unknown = response.headers.etag;
    return typeof etag === 'string' ? etag : null;
  } catch (error) {
    if (signal?.aborted) {
      // Old WebKit (iOS < 15.4) keeps no abort reason.
      throw signal.reason ?? error;
    }
    if (hasStalled) {
      throw new UploadFailure(FailureKind.Network, 'upload stalled');
    }
    const status = axios.isAxiosError(error) ? (error.response?.status ?? 0) : 0;
    throw new UploadFailure(failureFromStorageStatus(status), error);
  } finally {
    clearTimeout(stallTimer);
    signal?.removeEventListener('abort', stop);
  }
}
