/**
 * One presigned PUT to storage. XMLHttpRequest rather than fetch: fetch cannot report upload
 * progress, and the seller watches a 150 MB video go up.
 */

import {
  failureFromStorageStatus,
  FailureKind,
  UploadFailure,
} from '@/features/media/upload/retry-policy';

/**
 * No byte sent for this long means the connection is dead even if the socket is not: a
 * weak signal can stall a request for minutes. A whole-request timeout would instead cut
 * off a slow but moving 8 MB part.
 */
const STALL_TIMEOUT_MS = 30_000;

export interface PutOptions {
  /** Sent as Content-Type; photos must send the declared type, which the URL signs. */
  contentType?: string;
  onProgress?: (sentBytes: number) => void;
  signal?: AbortSignal;
}

/** Resolves with the ETag storage gave the object or part (null when CORS hides it). */
export function putBlob(
  url: string,
  body: Blob,
  { contentType, onProgress, signal }: PutOptions = {},
) {
  return new Promise<string | null>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const xhr = new XMLHttpRequest();
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let hasStalled = false;

    const finish = () => {
      clearTimeout(stallTimer);
      signal?.removeEventListener('abort', handleAbort);
    };
    const watchForStall = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        hasStalled = true;
        xhr.abort();
      }, STALL_TIMEOUT_MS);
    };
    const handleAbort = () => xhr.abort();

    xhr.open('PUT', url);
    if (contentType) {
      xhr.setRequestHeader('Content-Type', contentType);
    }

    xhr.upload.onprogress = (event) => {
      watchForStall();
      onProgress?.(event.loaded);
    };
    xhr.onload = () => {
      finish();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader('ETag'));
        return;
      }
      reject(
        new UploadFailure(failureFromStorageStatus(xhr.status), `storage answered ${xhr.status}`),
      );
    };
    xhr.onerror = () => {
      finish();
      reject(new UploadFailure(FailureKind.Network, 'no answer from storage'));
    };
    xhr.onabort = () => {
      finish();
      reject(
        hasStalled
          ? new UploadFailure(FailureKind.Network, 'upload stalled')
          : (signal?.reason ?? new DOMException('Aborted', 'AbortError')),
      );
    };

    signal?.addEventListener('abort', handleAbort);
    watchForStall();
    xhr.send(body);
  });
}
