/**
 * Uploads the draft's files once they are ready to upload (diagrams 04, 04b, 05), and asks
 * the server how processing goes until each is ready or failed. Module-level and driven by
 * the draft store, like media-intake.ts, so uploads go on while the seller is on another
 * page (diagram 08).
 */

import { type DraftMedia, DraftMediaStatus } from '@/features/listings/draft/media-reducer';
import { useListingDraftStore } from '@/features/listings/draft/store';
import { browserTransport } from '@/features/media/upload/browser-transport';
import { FileUpload, type UploadListener } from '@/features/media/upload/file-upload';
import { pollDelayMs } from '@/features/media/upload/retry-policy';
import {
  deleteMedia,
  fetchMediaStatuses,
  registerUploads,
} from '@/features/media/upload/upload-api';
import {
  MediaError,
  type ServerMedia,
  ServerMediaStatus,
  type UploadRequestFile,
} from '@/features/media/upload/upload-types';

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
}

type ReadyMedia = Extract<DraftMedia, { status: DraftMediaStatus.ReadyToUpload }>;
type UploadedMedia = Extract<DraftMedia, { status: DraftMediaStatus.Uploaded }>;

/** One per draft file that has started uploading, by draft ID, until it is removed. */
const entries = new Map<string, UploadEntry>();
let isRegistering = false;

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let pollRound = 0;

const draftMedia = () => useListingDraftStore.getState().media;
const dispatch = useListingDraftStore.getState().dispatchMedia;

function warnInDev(message: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.warn(`[upload] ${message}`, error);
  }
}

function deleteQuietly(mediaId: string) {
  // Best effort: media on no listing is removed by the hourly cleanup anyway (diagram 07).
  deleteMedia(mediaId).catch((error: unknown) => warnInDev('could not delete media', error));
}

function requestFor(media: ReadyMedia): UploadRequestFile {
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

/** Starts whatever can start: registers new ready files, then fills the free slots. */
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
    (item): item is ReadyMedia =>
      item.status === DraftMediaStatus.ReadyToUpload && !entries.has(item.id),
  );
  if (isRegistering || ready.length === 0) {
    return;
  }

  isRegistering = true;
  const requests = ready.map(requestFor);
  const batch = ready.map((item, index) => {
    const entry: UploadEntry = {
      upload: new FileUpload(requests[index], item.upload.blob, browserTransport),
      controller: new AbortController(),
      phase: Phase.Registering,
    };
    entries.set(item.id, entry);
    return entry;
  });

  try {
    const targets = await registerUploads(requests);
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
    // Each file then registers on its own when it starts, with the usual retries.
    warnInDev('registering the batch failed', error);
  } finally {
    isRegistering = false;
    for (const entry of batch) {
      entry.phase = Phase.Queued;
    }
    pump();
  }
}

function startQueued(media: DraftMedia[]) {
  let running = [...entries.values()].filter((entry) => entry.phase === Phase.Running).length;
  for (const item of media) {
    const entry = entries.get(item.id);
    if (running >= FILES_IN_FLIGHT) {
      return;
    }
    if (entry?.phase === Phase.Queued) {
      running += 1;
      void runUpload(item.id, entry);
    }
  }
}

function listenerFor(id: string): UploadListener {
  let shownPercent = -1;
  return {
    onProgress: (fraction) => {
      // XHR reports every few KB; the tile only needs whole percents.
      const percent = Math.floor(fraction * 100);
      if (percent !== shownPercent) {
        shownPercent = percent;
        dispatch({ type: 'progressed', id, progress: percent / 100 });
      }
    },
    onWaiting: (waitingFor) => dispatch({ type: 'uploadWaiting', id, waitingFor }),
    onResumed: () => dispatch({ type: 'uploadStarted', id }),
  };
}

async function runUpload(id: string, entry: UploadEntry) {
  entry.phase = Phase.Running;
  dispatch({ type: 'uploadStarted', id });
  try {
    const result = await entry.upload.run(listenerFor(id), entry.controller.signal);
    if (result.kind === 'uploaded') {
      entry.phase = Phase.Uploaded;
      const server = { status: result.status, thumbnailUrl: null, placeholder: null, error: null };
      dispatch({ type: 'uploaded', id, mediaId: result.mediaId, server });
      pollSoon();
    } else {
      entry.phase = Phase.Failed;
      dispatch({ type: 'uploadFailed', id, isRetryable: result.isRetryable });
    }
  } catch (error) {
    // Rejects only when removed, apart from a bug; the seller can still retry that.
    if (!entry.controller.signal.aborted) {
      warnInDev('upload stopped unexpectedly', error);
      entry.phase = Phase.Failed;
      dispatch({ type: 'uploadFailed', id, isRetryable: true });
    }
  } finally {
    pump();
  }
}

// ---- Processing status, until each file is ready or failed ----

/** The thumbnail comes with READY; until then the server is still working on it. */
const isWaitingForServer = (server: ServerMedia) =>
  server.status !== ServerMediaStatus.Failed && server.thumbnailUrl === null;

function mediaToPoll() {
  return draftMedia().filter(
    (item): item is UploadedMedia =>
      item.status === DraftMediaStatus.Uploaded && isWaitingForServer(item.server),
  );
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (mediaToPoll().length === 0) {
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

async function pollStatuses() {
  const waiting = mediaToPoll();
  if (waiting.length === 0) {
    return;
  }
  try {
    const statuses = await fetchMediaStatuses(waiting.map((item) => item.mediaId));
    const byId = new Map(statuses.map((status) => [status.id, status]));
    for (const item of waiting) {
      const server = byId.get(item.mediaId) ?? {
        status: ServerMediaStatus.Failed,
        thumbnailUrl: null,
        placeholder: null,
        error: MediaError.Missing,
      };
      dispatch({ type: 'serverUpdated', id: item.id, server });
    }
  } catch (error) {
    // The next round asks again.
    warnInDev('polling media status failed', error);
  }
  schedulePoll();
}

// ---- What the draft and the form call ----

/** The seller tapped Retry on a failed upload. */
export function retryUpload(id: string) {
  const entry = entries.get(id);
  if (entry?.phase === Phase.Failed) {
    entry.phase = Phase.Queued;
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

useListingDraftStore.subscribe(pump);
