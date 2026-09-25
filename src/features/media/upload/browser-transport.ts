/** The real network and clock behind FileUpload. */

import type { UploadTransport } from '@/features/media/upload/file-upload';
import { putBlob } from '@/features/media/upload/put-blob';
import {
  completeParts,
  completeUpload,
  refreshUploadUrl,
  registerUploads,
} from '@/features/media/upload/upload-api';
import { FailureKind, UploadFailure } from '@/features/media/upload/retry-policy';

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

export const browserTransport: UploadTransport = {
  register: async (file, signal) => {
    const [target] = await registerUploads([file], signal);
    if (!target) {
      throw new UploadFailure(FailureKind.Server, 'no upload target returned');
    }
    return target;
  },
  refresh: refreshUploadUrl,
  put: putBlob,
  completeParts,
  complete: completeUpload,

  // A WebView that does not know says true, which only means a lost network costs an attempt.
  isOnline: () => navigator.onLine !== false,

  waitForNetwork: (signal) =>
    new Promise((resolve, reject) => {
      if (navigator.onLine !== false) {
        resolve();
        return;
      }
      const handleOnline = () => {
        stopWatchingAbort();
        resolve();
      };
      window.addEventListener('online', handleOnline, { once: true });
      const stopWatchingAbort = whenAborted(signal, reject, () =>
        window.removeEventListener('online', handleOnline),
      );
    }),

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
