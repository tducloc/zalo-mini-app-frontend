/**
 * Uploads the draft's files once they are ready to upload (diagrams 04, 04b, 05), and asks
 * the server how processing goes until each is ready or failed. Module-level and driven by
 * the draft store, like media-intake.ts, so uploads go on while the seller is on another
 * page (diagram 08). Importing this module starts it: it subscribes to the store at the
 * bottom of the file.
 */

import PQueue from 'p-queue';

import {
  DraftMediaStatus,
  isServerSettled,
  type MediaAction,
  MediaActionType,
  type ReadyDraftMedia,
  type UploadedDraftMedia,
} from '@/features/listings/draft/media-reducer';
import { useListingDraftStore } from '@/features/listings/draft/store';
import { FileUpload, type UploadListener } from '@/features/media/upload/file-upload';
import { FailureKind } from '@/features/media/upload/retry-policy';
import {
  browserTransport,
  deleteMedia,
  fetchMediaStatuses,
} from '@/features/media/upload/upload-api';
import {
  MediaError,
  type MediaStatusItem,
  type ServerMedia,
  ServerMediaStatus,
  type UploadRequestFile,
} from '@/features/media/upload/upload-types';
import { warnInDev } from '@/utils/dev-log';

/**
 * Files uploading at once. On a phone's uplink more would only split the bandwidth, and
 * finishing files one after another lets the server start processing the first sooner;
 * fewer requests at once also means a dropped connection fails fewer of them.
 */
const FILES_IN_FLIGHT = 2;

/**
 * How often to ask the server about files it is processing: a photo takes a second or
 * two, a video up to a minute. One request covers every file, so a steady pace is cheap.
 */
const POLL_INTERVAL_MS = 3_000;

/** Right after `complete`: no thumbnail or reason yet. */
const NOTHING_YET: ServerMedia = {
  status: ServerMediaStatus.Processing,
  thumbnailUrl: null,
  placeholder: null,
  error: null,
};

interface UploadEntry {
  upload: FileUpload;
  /** Aborted when the seller removes the file. */
  controller: AbortController;
  /** Why the last run failed, when it did. */
  failure: FailureKind | null;
}

/** One per draft file that is ready to upload or further on, by draft ID, until removed. */
const entries = new Map<string, UploadEntry>();
/** Files start in the order they became ready; a retried file joins the end. */
const uploadQueue = new PQueue({ concurrency: FILES_IN_FLIGHT });

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let isPolling = false;

const draftMedia = () => useListingDraftStore.getState().media;

const statusOf = (id: string) => draftMedia().find((item) => item.id === id)?.status;

const dispatch = (action: MediaAction) => useListingDraftStore.getState().dispatchMedia(action);

const warn = (message: string, error: unknown) => warnInDev('upload', message, error);

function deleteQuietly(mediaId: string) {
  // Best effort: media on no listing is removed by the hourly cleanup anyway (diagram 07).
  deleteMedia(mediaId).catch((error: unknown) => warn('could not delete media', error));
}

// ---- Uploading ----

function requestFor(media: ReadyDraftMedia): UploadRequestFile {
  return {
    clientFileId: media.id,
    type: media.kind,
    contentType: media.upload.contentType,
    size: media.upload.blob.size,
    originalBytes: media.original.bytes,
    originalWidth: media.original.width ?? undefined,
    originalHeight: media.original.height ?? undefined,
    optimized: media.upload.optimized,
  };
}

/**
 * Queues each file that became ready. It asks for its own upload URL when it starts
 * (FileUpload), not all together: the call is quick, a URL taken right before the upload
 * is fresh, and the limit of 60 an hour is per seller, far above the 11 a listing needs.
 */
function queueReady() {
  for (const item of draftMedia()) {
    if (item.status === DraftMediaStatus.ReadyToUpload && !entries.has(item.id)) {
      const entry: UploadEntry = {
        upload: new FileUpload(requestFor(item), item.upload.blob, browserTransport),
        controller: new AbortController(),
        failure: null,
      };
      entries.set(item.id, entry);
      enqueue(item.id, entry);
    }
  }
}

function enqueue(id: string, entry: UploadEntry) {
  // A file removed while waiting gives up its turn at once.
  void uploadQueue.add(() =>
    entry.controller.signal.aborted ? Promise.resolve() : runUpload(id, entry),
  );
}

function listenerFor(id: string, entry: UploadEntry): UploadListener {
  let shownPercent = -1;
  return {
    onRegistered: (mediaId) => {
      // Removed while asking for the URL: the server made the media anyway.
      if (entries.get(id) !== entry) {
        deleteQuietly(mediaId);
      }
    },
    onProgress: (fraction) => {
      // Progress comes every few KB; the tile only needs whole percents.
      const percent = Math.floor(fraction * 100);
      if (percent !== shownPercent) {
        shownPercent = percent;
        dispatch({ type: MediaActionType.UploadProgressed, id, progress: percent / 100 });
      }
    },
    onWaiting: (waitingFor) => dispatch({ type: MediaActionType.UploadWaiting, id, waitingFor }),
    onResumed: () => dispatch({ type: MediaActionType.UploadResumed, id }),
  };
}

async function runUpload(id: string, entry: UploadEntry) {
  dispatch({ type: MediaActionType.UploadStarted, id });
  try {
    const result = await entry.upload.run(listenerFor(id, entry), entry.controller.signal);
    if (entry.controller.signal.aborted) {
      return;
    }
    if (result.kind === 'failed') {
      entry.failure = result.failure;
      dispatch({ type: MediaActionType.UploadFailed, id, isRetryable: result.isRetryable });
      return;
    }
    const server = { ...NOTHING_YET, status: result.status };
    dispatch({ type: MediaActionType.Uploaded, id, mediaId: result.mediaId, server });
    schedulePoll();
  } catch (error) {
    // Rejects only when removed, apart from a bug; the seller can still retry that.
    if (!entry.controller.signal.aborted) {
      warn('upload stopped unexpectedly', error);
      dispatch({ type: MediaActionType.UploadFailed, id, isRetryable: true });
    }
  }
}

function requeue(id: string, entry: UploadEntry) {
  entry.failure = null;
  entry.upload.markUrlsStale();
  dispatch({ type: MediaActionType.UploadQueued, id });
  enqueue(id, entry);
}

// ---- Processing status, until each file is ready or failed ----

const isMediaError = (code: string): code is MediaError =>
  Object.values<string>(MediaError).includes(code);

/** A FAILED gets a reason the app knows, so it settles and is not asked about forever. */
function serverMediaFrom(item: MediaStatusItem | undefined): ServerMedia {
  if (!item) {
    // No longer listed, e.g. removed by the hourly cleanup.
    return { ...NOTHING_YET, status: ServerMediaStatus.Failed, error: MediaError.Missing };
  }
  const { status, thumbnailUrl, placeholder, error } = item;
  if (status !== ServerMediaStatus.Failed) {
    return { status, thumbnailUrl, placeholder, error: null };
  }
  const reason = error && isMediaError(error) ? error : MediaError.ProcessingFailed;
  return { status, thumbnailUrl, placeholder, error: reason };
}

function mediaToPoll() {
  return draftMedia().filter(
    (item): item is UploadedDraftMedia =>
      item.status === DraftMediaStatus.Uploaded && !isServerSettled(item.server),
  );
}

/** One request at a time, every POLL_INTERVAL_MS while some file is still processing. */
function schedulePoll() {
  if (pollTimer !== undefined || isPolling || mediaToPoll().length === 0) {
    return;
  }
  pollTimer = setTimeout(() => {
    pollTimer = undefined;
    void pollStatuses();
  }, POLL_INTERVAL_MS);
}

async function pollStatuses() {
  const waiting = mediaToPoll();
  isPolling = true;
  try {
    const statuses = await fetchMediaStatuses(waiting.map((item) => item.mediaId));
    const byId = new Map(statuses.map((item) => [item.id, item]));
    for (const item of waiting) {
      const server = serverMediaFrom(byId.get(item.mediaId));
      dispatch({ type: MediaActionType.ServerUpdated, id: item.id, server });
    }
  } catch (error) {
    // The next round asks again.
    warn('polling media status failed', error);
  } finally {
    isPolling = false;
  }
  schedulePoll();
}

// ---- What the draft and the form call ----

/** The seller tapped Retry on a failed upload; a second tap finds it queued already. */
export function retryUpload(id: string) {
  const entry = entries.get(id);
  if (entry && statusOf(id) === DraftMediaStatus.UploadFailed) {
    requeue(id, entry);
  }
}

/** Stops the file's upload and deletes it on the server, if it got that far. */
export function cancelUpload(id: string) {
  const entry = entries.get(id);
  if (!entry) {
    return;
  }
  entries.delete(id);
  entry.controller.abort();
  if (entry.upload.mediaId) {
    deleteQuietly(entry.upload.mediaId);
  }
}

/**
 * Uploads that failed for lack of network start again once it is back, e.g. when the
 * WebView said online all along; the seller need not tap Retry.
 */
function retryAfterNetworkLoss() {
  for (const [id, entry] of entries) {
    if (entry.failure === FailureKind.Network && statusOf(id) === DraftMediaStatus.UploadFailed) {
      requeue(id, entry);
    }
  }
}

const unsubscribe = useListingDraftStore.subscribe(queueReady);
if (typeof window !== 'undefined') {
  window.addEventListener('online', retryAfterNetworkLoss);
}

// Dev only: a hot reload would otherwise leave the old module uploading the same files too.
import.meta.hot?.dispose(() => {
  unsubscribe();
  clearTimeout(pollTimer);
  window.removeEventListener('online', retryAfterNetworkLoss);
});
