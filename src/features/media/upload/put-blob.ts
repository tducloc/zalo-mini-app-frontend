/**
 * One presigned PUT to storage. XMLHttpRequest rather than fetch: fetch cannot report upload
 * progress, and the seller watches a 150 MB video go up.
 */

import type { PutOptions } from '@/features/media/upload/file-upload';
import {
  failureFromStorageStatus,
  FailureKind,
  UploadFailure,
} from '@/features/media/upload/upload-failure';

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

    const handleAbort = () => xhr.abort();
    const cleanUp = () => {
      clearTimeout(stallTimer);
      signal?.removeEventListener('abort', handleAbort);
    };
    const watchForStall = (timeoutMs = STALL_TIMEOUT_MS) => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        hasStalled = true;
        xhr.abort();
      }, timeoutMs);
    };

    xhr.open('PUT', url);
    if (contentType) {
      xhr.setRequestHeader('Content-Type', contentType);
    }

    xhr.upload.onprogress = (event) => {
      watchForStall();
      onProgress?.(event.loaded);
    };
    xhr.upload.onload = () => watchForStall(RESPONSE_TIMEOUT_MS);
    xhr.onload = () => {
      cleanUp();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader('ETag'));
        return;
      }
      reject(
        new UploadFailure(failureFromStorageStatus(xhr.status), `storage answered ${xhr.status}`),
      );
    };
    xhr.onerror = () => {
      cleanUp();
      reject(new UploadFailure(FailureKind.Network, 'no answer from storage'));
    };
    xhr.onabort = () => {
      cleanUp();
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
