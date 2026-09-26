/**
 * The transport FileUpload runs on in the app: the HTTP calls of api/media-uploads.ts, plus the
 * browser's online/offline signals. Tests give FileUpload a fake instead.
 */

import {
  completeParts,
  completeUpload,
  putBlob,
  refreshUploadUrl,
  registerUploads,
} from '@/features/media/api/media-uploads';
import { type UploadTransport, FailureKind } from '@/features/media/types/upload';
import { UploadFailure } from '@/features/media/utils/retry-policy';

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
      signal.removeEventListener('abort', handleAbort);
    };
    const check = () => {
      if (isOnline() || Date.now() - startedAt >= MAX_NETWORK_WAIT_MS) {
        stopListening();
        resolve();
      }
    };
    const handleAbort = () => {
      stopListening();
      reject(signal.reason);
    };

    const timer = setInterval(check, NETWORK_RECHECK_MS);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    signal.addEventListener('abort', handleAbort, { once: true });
    if (signal.aborted) {
      handleAbort();
    }
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
  now: Date.now,
};
