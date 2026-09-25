/**
 * Uploads the draft's files once they are ready to upload (diagrams 04, 04b, 05), and asks
 * the server how processing goes until each is ready or failed. Module-level and driven by
 * the draft store, like media-intake.ts, so uploads go on while the seller is on another
 * page (diagram 08). Importing this module starts it: it subscribes to the store at the
 * bottom of the file.
 */

import {
  type DraftMedia,
  DraftMediaStatus,
  isServerSettled,
  type MediaAction,
  type ReadyDraftMedia,
  type UploadedDraftMedia,
} from '@/features/listings/draft/media-reducer';
import { useListingDraftStore } from '@/features/listings/draft/store';
import { browserTransport } from '@/features/media/upload/browser-transport';
import { FileUpload, type UploadListener } from '@/features/media/upload/file-upload';
import { pollDelayMs } from '@/features/media/upload/retry-policy';
import {
  deleteMedia,
  fetchMediaStatuses,
  registerUploads,
} from '@/features/media/upload/upload-api';
import { FailureKind } from '@/features/media/upload/upload-failure';
import {
  MediaError,
  type ServerMedia,
  ServerMediaStatus,
  type UploadRequestFile,
} from '@/features/media/upload/upload-types';
import { warnInDev } from '@/utils/dev-log';

/**
 * Files uploading at once. On a phone's uplink more would only split the bandwidth, and
 * finishing files one after another lets the server start processing the first sooner.
 */
const FILES_IN_FLIGHT = 2;

enum Phase {
  /** In a registration request with other files. */
  Registering = 'REGISTERING',
  /** Waiting for a free slot. */
  Queued = 'QUEUED',
  Running = 'RUNNING',
  Failed = 'FAILED',
  Uploaded = 'UPLOADED',
}

interface UploadEntry {
  upload: FileUpload;
  controller: AbortController;
  phase: Phase;
  /** Why the last run failed, when it did. */
  failure: FailureKind | null;
}

/** For a media the server no longer lists, e.g. after the hourly cleanup. */
const MISSING_ON_SERVER: ServerMedia = {
  status: ServerMediaStatus.Failed,
  thumbnailUrl: null,
  placeholder: null,
  error: MediaError.Missing,
};

/** One per draft file that has started uploading, by draft ID, until it is removed. */
const entries = new Map<string, UploadEntry>();
let isRegistering = false;

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let pollRound = 0;
let isPolling = false;

const draftMedia = () => useListingDraftStore.getState().media;

const dispatch = (action: MediaAction) => useListingDraftStore.getState().dispatchMedia(action);

const warn = (message: string, error: unknown) => warnInDev('upload', message, error);

function deleteQuietly(mediaId: string) {
  // Best effort: media on no listing is removed by the hourly cleanup anyway (diagram 07).
  deleteMedia(mediaId).catch((error: unknown) => warn('could not delete media', error));
}

const justUploaded = (status: ServerMediaStatus): ServerMedia => ({
  status,
  thumbnailUrl: null,
  placeholder: null,
  error: null,
});

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
 * Starts whatever can start: registers new ready files, then fills the free slots. Runs on
 * every store change, when a batch registration answers, and when an upload ends; it can
 * run again from inside itself, because starting an upload dispatches.
 */
function pump() {
  const media = draftMedia();
  void registerReady(media);
  startQueued(media);
}

/**
 * One `upload-urls` request for every file that became ready meanwhile, rather than one
 * each: the endpoint is rate limited, and one round trip is faster on a phone.
 */
async function registerReady(media: DraftMedia[]) {
  const ready = media.filter(
    (item): item is ReadyDraftMedia =>
      item.status === DraftMediaStatus.ReadyToUpload && !entries.has(item.id),
  );
  if (isRegistering || ready.length === 0) {
    return;
  }

  isRegistering = true;
  const batch = ready.map((item) => {
    const request = requestFor(item);
    const entry: UploadEntry = {
      upload: new FileUpload(request, item.upload.blob, browserTransport),
      controller: new AbortController(),
      phase: Phase.Registering,
      failure: null,
    };
    entries.set(item.id, entry);
    return { entry, request };
  });

  try {
    const targets = await registerUploads(batch.map(({ request }) => request));
    for (const target of targets) {
      const entry = entries.get(target.clientFileId);
      if (entry) {
        entry.upload.assign(target);
      } else {
        // Removed while the request was on its way.
        deleteQuietly(target.mediaId);
      }
    }
  } catch (error) {
    // Each file then registers on its own when it starts, with the usual retries. If the
    // server created the rows before the answer was lost, the hourly cleanup removes them.
    warn('registering the batch failed', error);
  } finally {
    isRegistering = false;
    for (const { entry } of batch) {
      entry.phase = Phase.Queued;
    }
    pump();
  }
}

function startQueued(media: DraftMedia[]) {
  const runningCount = [...entries.values()].filter(
    (entry) => entry.phase === Phase.Running,
  ).length;
  const toStart = media
    .map((item) => ({ id: item.id, entry: entries.get(item.id) }))
    .filter(
      (item): item is { id: string; entry: UploadEntry } => item.entry?.phase === Phase.Queued,
    )
    .slice(0, Math.max(0, FILES_IN_FLIGHT - runningCount));

  // All marked running before any starts: starting dispatches, which runs pump again, and
  // that inner pump must count them.
  for (const { entry } of toStart) {
    entry.phase = Phase.Running;
  }
  for (const { id, entry } of toStart) {
    void runUpload(id, entry);
  }
}

function listenerFor(id: string, entry: UploadEntry): UploadListener {
  let shownPercent = -1;
  return {
    onRegistered: (mediaId) => {
      // Removed while registering: the server made it anyway.
      if (entries.get(id) !== entry) {
        deleteQuietly(mediaId);
      }
    },
    onProgress: (fraction) => {
      // XHR reports every few KB; the tile only needs whole percents.
      const percent = Math.floor(fraction * 100);
      if (percent !== shownPercent) {
        shownPercent = percent;
        dispatch({ type: 'progressed', id, progress: percent / 100 });
      }
    },
    onWaiting: (waitingFor) => dispatch({ type: 'uploadWaiting', id, waitingFor }),
    onResumed: () => dispatch({ type: 'uploadResumed', id }),
  };
}

async function runUpload(id: string, entry: UploadEntry) {
  dispatch({ type: 'uploadStarted', id });
  try {
    const result = await entry.upload.run(listenerFor(id, entry), entry.controller.signal);
    if (result.kind === 'uploaded') {
      entry.phase = Phase.Uploaded;
      dispatch({
        type: 'uploaded',
        id,
        mediaId: result.mediaId,
        server: justUploaded(result.status),
      });
      pollSoon();
    } else {
      entry.phase = Phase.Failed;
      entry.failure = result.failure;
      dispatch({ type: 'uploadFailed', id, isRetryable: result.isRetryable });
    }
  } catch (error) {
    // Rejects only when removed, apart from a bug; the seller can still retry that.
    if (!entry.controller.signal.aborted) {
      warn('upload stopped unexpectedly', error);
      entry.phase = Phase.Failed;
      dispatch({ type: 'uploadFailed', id, isRetryable: true });
    }
  } finally {
    pump();
  }
}

// ---- Processing status, until each file is ready or failed ----

function mediaToPoll() {
  return draftMedia().filter(
    (item): item is UploadedDraftMedia =>
      item.status === DraftMediaStatus.Uploaded && !isServerSettled(item.server),
  );
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (isPolling || mediaToPoll().length === 0) {
    return;
  }
  pollTimer = setTimeout(() => void pollStatuses(), pollDelayMs(pollRound));
  pollRound += 1;
}

/** A file just finished uploading: ask quickly again, then less often. */
function pollSoon() {
  pollRound = 0;
  schedulePoll();
}

/** One request at a time; the one in flight schedules the next when it answers. */
async function pollStatuses() {
  const waiting = mediaToPoll();
  if (waiting.length === 0) {
    return;
  }

  isPolling = true;
  try {
    const statuses = await fetchMediaStatuses(waiting.map((item) => item.mediaId));
    const byId = new Map(statuses.map((status) => [status.id, status]));
    for (const item of waiting) {
      dispatch({
        type: 'serverUpdated',
        id: item.id,
        server: serverMediaFrom(byId.get(item.mediaId)),
      });
    }
  } catch (error) {
    // The next round asks again.
    warn('polling media status failed', error);
  } finally {
    isPolling = false;
  }
  schedulePoll();
}

function serverMediaFrom(status: ServerMedia | undefined): ServerMedia {
  if (!status) {
    return MISSING_ON_SERVER;
  }
  // A FAILED without a reason would be asked about forever; any reason settles it.
  const isFailedWithoutReason = status.status === ServerMediaStatus.Failed && !status.error;
  return {
    status: status.status,
    thumbnailUrl: status.thumbnailUrl,
    placeholder: status.placeholder,
    error: isFailedWithoutReason ? MediaError.ProcessingFailed : status.error,
  };
}

// ---- What the draft and the form call ----

function requeue(entry: UploadEntry) {
  entry.phase = Phase.Queued;
  entry.failure = null;
  entry.upload.markUrlsStale();
}

/** The seller tapped Retry on a failed upload. */
export function retryUpload(id: string) {
  const entry = entries.get(id);
  if (entry?.phase === Phase.Failed) {
    requeue(entry);
    pump();
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
 * Uploads that ran out of attempts for lack of network start again once it is back, e.g.
 * after a lift ride that outlasted the retry waits; the seller need not tap Retry.
 */
function retryAfterNetworkLoss() {
  let hasRequeued = false;
  for (const entry of entries.values()) {
    if (entry.phase === Phase.Failed && entry.failure === FailureKind.Network) {
      requeue(entry);
      hasRequeued = true;
    }
  }
  if (hasRequeued) {
    pump();
  }
}

const unsubscribe = useListingDraftStore.subscribe(pump);
if (typeof window !== 'undefined') {
  window.addEventListener('online', retryAfterNetworkLoss);
}

// Dev only: a hot reload would otherwise leave the old module uploading the same files too.
import.meta.hot?.dispose(() => {
  unsubscribe();
  window.removeEventListener('online', retryAfterNetworkLoss);
});
