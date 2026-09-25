/** The real network and clock behind FileUpload. */

import type { UploadTransport } from '@/features/media/upload/file-upload';
import { putBlob } from '@/features/media/upload/put-blob';
import {
  completeParts,
  completeUpload,
  refreshUploadUrl,
  registerUploads,
} from '@/features/media/upload/upload-api';
import { FailureKind, UploadFailure } from '@/features/media/upload/upload-failure';

/**
 * While offline, look again this often: a WebView can miss the `online` event, or come
 * back from the background without one.
 */
const NETWORK_RECHECK_MS = 5_000;
/**
 * Stop waiting after this long and let an attempt find out: `onLine` can stay false in a
 * WebView that is online. If it really is offline, the attempt fails as offline and the
 * wait starts again, still using up no attempt.
 */
const MAX_NETWORK_WAIT_MS = 60_000;

// A WebView that does not know says true, which only means a lost network costs an attempt.
const isOnline = () => navigator.onLine !== false;

function whenAborted(signal: AbortSignal, reject: (reason: unknown) => void, cleanUp: () => void) {
  const handleAbort = () => {
    cleanUp();
    reject(signal.reason);
  };
  if (signal.aborted) {
    handleAbort();
  }
  signal.addEventListener('abort', handleAbort, { once: true });
  return () => signal.removeEventListener('abort', handleAbort);
}

function waitForNetwork(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (isOnline()) {
      resolve();
      return;
    }

    const startedAt = Date.now();
    const stopListening = () => {
      clearInterval(timer);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
    const check = () => {
      if (isOnline() || Date.now() - startedAt >= MAX_NETWORK_WAIT_MS) {
        stopListening();
        stopWatchingAbort();
        resolve();
      }
    };

    const timer = setInterval(check, NETWORK_RECHECK_MS);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    const stopWatchingAbort = whenAborted(signal, reject, stopListening);
  });
}

export const browserTransport: UploadTransport = {
  register: async (file) => {
    const [target] = await registerUploads([file]);
    if (!target) {
      throw new UploadFailure(FailureKind.Server, 'no upload target returned');
    }
    return target;
  },
  refresh: refreshUploadUrl,
  put: putBlob,
  completeParts,
  complete: completeUpload,

  isOnline,
  waitForNetwork,

  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        stopWatchingAbort();
        resolve();
      }, ms);
      const stopWatchingAbort = whenAborted(signal, reject, () => clearTimeout(timer));
    }),

  random: Math.random,
  now: Date.now,
};
