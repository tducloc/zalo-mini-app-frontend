/**
 * Uploads one file and follows diagram 05 when it fails: photo in one PUT, video in parts of
 * the server's part size, PARTS_IN_FLIGHT at a time (p-limit), then `complete`. p-retry
 * runs the attempts. Remembers what already reached storage, so another attempt, or the
 * seller's Retry, sends only what is missing.
 *
 * The network comes in through UploadTransport, so the tests drive every failure.
 */

import pLimit from 'p-limit';
import pRetry, { type RetryContext } from 'p-retry';

import {
  MAX_UPLOAD_ATTEMPTS,
  RETRY_TIMING,
  UPLOAD_URL_LIFETIME_MS,
} from '@/features/media/constants/upload';
import { MediaKind } from '@/features/media/types/media';
import {
  type UploadRequestFile,
  type UploadTarget,
  type UploadTransport,
  UploadWait,
  type UploadListener,
  type UploadResult,
  FailureKind,
} from '@/features/media/types/upload';
import { isRetryable, isUrlExpiring, UploadFailure } from '@/features/media/utils/retry-policy';

/** Parts of one video in flight at once (api-spec: "at most 3 at once"). */
const PARTS_IN_FLIGHT = 3;

/** Bytes in 1-based part `partNumber` of a `size`-byte file cut in `partSize` pieces. */
function partBytes(size: number, partSize: number, partNumber: number) {
  return Math.min(partSize, size - (partNumber - 1) * partSize);
}

/**
 * The server's view of one registered media, replaced whole when the server loses it, so a
 * new registration starts with nothing of the old one.
 */
type ServerUpload = {
  mediaId: string;
  /** On the client's clock; see UPLOAD_URL_LIFETIME_MS. */
  urlsValidUntil: number;
  hasStaleUrls: boolean;
  /** The whole file is in storage (the PUT, or parts/complete, succeeded). */
  isStored: boolean;
} & (PhotoUpload | VideoUpload);

interface PhotoUpload {
  type: MediaKind.Image;
  url: string;
}

interface VideoUpload {
  type: MediaKind.Video;
  partSize: number;
  partUrls: Map<number, string>;
  /** ETag of each part storage has, by part number. */
  sentParts: Map<number, string>;
}

export class FileUpload {
  private server: ServerUpload | null = null;
  private refreshing: Promise<void> | null = null;

  constructor(
    private readonly request: UploadRequestFile,
    private readonly blob: Blob,
    private readonly transport: UploadTransport,
    /** The waits between attempts; tests pass none. */
    private readonly retryTiming = RETRY_TIMING,
  ) {}

  /** The server's ID once registered; it changes if the server lost the first one. */
  get mediaId() {
    return this.server?.mediaId ?? null;
  }

  /** The seller taps Retry: start with fresh URLs, as diagram 05 draws it. */
  markUrlsStale() {
    if (this.server) {
      this.server.hasStaleUrls = true;
    }
  }

  /** Attempts until uploaded, refused for good, or out of attempts. Rejects only on abort. */
  async run(listener: UploadListener, signal: AbortSignal): Promise<UploadResult> {
    let isWaiting = false;
    const wait = (reason: UploadWait) => {
      isWaiting = true;
      listener.onWaiting(reason);
    };
    const resume = () => {
      if (isWaiting) {
        isWaiting = false;
        listener.onResumed();
      }
    };

    // Offline is a pause, not a failure: it uses up no attempt (diagram 05). So it is
    // handled inside one p-retry attempt, and p-retry only sees failures that count; its
    // own shouldConsumeRetry is checked after "no retries left", too late for the last one.
    const attemptWhenOnline = async () => {
      for (;;) {
        if (!this.transport.isOnline()) {
          wait(UploadWait.Network);
          await this.transport.waitForNetwork(signal);
        }
        resume();
        try {
          return await this.attempt(listener, signal);
        } catch (error) {
          if (!this.isOfflineFailure(error)) {
            throw error;
          }
        }
      }
    };

    const handleFailure = ({ error, retriesLeft }: RetryContext) => {
      if (!(error instanceof UploadFailure)) {
        return;
      }
      this.recover(error.kind);
      if (isRetryable(error.kind) && retriesLeft > 0) {
        wait(UploadWait.Retry);
      }
    };

    try {
      return await pRetry(attemptWhenOnline, {
        ...this.retryTiming,
        retries: MAX_UPLOAD_ATTEMPTS - 1,
        signal,
        shouldRetry: ({ error }) => error instanceof UploadFailure && isRetryable(error.kind),
        onFailedAttempt: handleFailure,
      });
    } catch (error) {
      if (signal.aborted || !(error instanceof UploadFailure)) {
        throw error;
      }
      return { kind: 'failed', isRetryable: isRetryable(error.kind) };
    }
  }

  private async attempt(listener: UploadListener, signal: AbortSignal): Promise<UploadResult> {
    const server = this.server ?? (await this.register(listener, signal));

    if (!server.isStored) {
      await (server.type === MediaKind.Video
        ? this.sendParts(server, listener, signal)
        : this.sendPhoto(server, listener, signal));
      server.isStored = true;
    }

    return {
      kind: 'uploaded',
      mediaId: server.mediaId,
      status: await this.complete(server, signal),
    };
  }

  private async register(listener: UploadListener, signal: AbortSignal) {
    const target = await this.transport.register(this.request);
    const server: ServerUpload = {
      mediaId: target.mediaId,
      urlsValidUntil: this.urlsValidUntil(),
      hasStaleUrls: false,
      isStored: false,
      ...(target.type === MediaKind.Image
        ? { type: MediaKind.Image, url: target.presignedUrl }
        : {
            type: MediaKind.Video,
            partSize: target.partSize,
            partUrls: new Map(target.parts.map((part) => [part.partNumber, part.presignedUrl])),
            sentParts: new Map(),
          }),
    };
    this.server = server;
    listener.onRegistered(server.mediaId);
    signal.throwIfAborted();
    return server;
  }

  private isOfflineFailure(error: unknown) {
    return (
      error instanceof UploadFailure &&
      error.kind === FailureKind.Network &&
      !this.transport.isOnline()
    );
  }

  /** Clears whatever the failure showed to be wrong, before the next attempt. */
  private recover(kind: FailureKind) {
    // The server no longer has the media: register again and send everything.
    if (kind === FailureKind.Gone) {
      this.server = null;
    }
    if (kind === FailureKind.Expired) {
      this.markUrlsStale();
    }
  }

  private async complete(server: ServerUpload, signal: AbortSignal) {
    try {
      return await this.transport.complete(server.mediaId, signal);
    } catch (error) {
      if (error instanceof UploadFailure && error.kind === FailureKind.Conflict) {
        // Storage does not have the whole file after all. A photo is simply sent again; a
        // video's parts may no longer join, so it starts over as a new media.
        if (server.type === MediaKind.Video) {
          this.server = null;
        } else {
          server.isStored = false;
        }
      }
      throw error;
    }
  }

  private async sendPhoto(
    server: ServerUpload & PhotoUpload,
    listener: UploadListener,
    signal: AbortSignal,
  ) {
    await this.ensureFreshUrls(server, undefined, signal);
    await this.transport.put(server.url, this.blob, {
      contentType: this.request.contentType,
      signal,
      onProgress: (sent) => listener.onProgress(sent / this.blob.size),
    });
  }

  private async sendParts(
    server: ServerUpload & VideoUpload,
    listener: UploadListener,
    signal: AbortSignal,
  ) {
    await this.sendUnsentParts(server, listener, signal);
    await this.joinParts(server, signal);
  }

  /** PARTS_IN_FLIGHT at a time; one failed part stops the others and fails the attempt. */
  private async sendUnsentParts(
    server: ServerUpload & VideoUpload,
    listener: UploadListener,
    signal: AbortSignal,
  ) {
    const inFlight = new Map<number, number>();
    const reportProgress = () =>
      listener.onProgress(this.storedBytes(server, inFlight) / this.blob.size);

    // Stopping the others means the next attempt never overlaps this one.
    const attemptController = new AbortController();
    const stopAll = () => attemptController.abort(signal.reason);
    signal.addEventListener('abort', stopAll);
    let firstFailure: unknown = null;

    // Never rejects, so the others keep their place in line until they see the abort.
    const sendOne = async (partNumber: number) => {
      if (attemptController.signal.aborted) {
        return;
      }
      try {
        await this.sendPart(server, partNumber, attemptController.signal, (sent) => {
          inFlight.set(partNumber, sent);
          reportProgress();
        });
      } catch (error) {
        if (!attemptController.signal.aborted) {
          firstFailure = error;
          attemptController.abort();
        }
      } finally {
        inFlight.delete(partNumber);
        reportProgress();
      }
    };

    await pLimit(PARTS_IN_FLIGHT).map(this.unsentParts(server), sendOne);
    signal.removeEventListener('abort', stopAll);

    signal.throwIfAborted();
    if (firstFailure) {
      throw firstFailure;
    }
  }

  /** Bytes of the parts storage has, plus those on their way. */
  private storedBytes(server: VideoUpload, inFlight: Map<number, number>) {
    let bytes = 0;
    for (const partNumber of server.sentParts.keys()) {
      bytes += partBytes(this.blob.size, server.partSize, partNumber);
    }
    for (const sent of inFlight.values()) {
      bytes += sent;
    }
    return bytes;
  }

  private async joinParts(server: ServerUpload & VideoUpload, signal: AbortSignal) {
    const parts = [...server.sentParts]
      .map(([partNumber, etag]) => ({ partNumber, etag }))
      .sort((a, b) => a.partNumber - b.partNumber);
    await this.transport.completeParts(server.mediaId, parts, signal);
  }

  private async sendPart(
    server: ServerUpload & VideoUpload,
    partNumber: number,
    signal: AbortSignal,
    onProgress: (sent: number) => void,
  ) {
    await this.ensureFreshUrls(server, this.unsentParts(server), signal);
    const url = server.partUrls.get(partNumber);
    if (!url) {
      throw new UploadFailure(FailureKind.Rejected, `no upload URL for part ${partNumber}`);
    }

    const start = (partNumber - 1) * server.partSize;
    const body = this.blob.slice(
      start,
      start + partBytes(this.blob.size, server.partSize, partNumber),
    );
    const etag = await this.transport.put(url, body, { signal, onProgress });
    if (!etag) {
      // parts/complete needs every ETag; the bucket's CORS must expose it.
      throw new UploadFailure(FailureKind.Rejected, `storage hid the ETag of part ${partNumber}`);
    }
    server.sentParts.set(partNumber, etag);
  }

  private unsentParts(server: VideoUpload) {
    const count = Math.max(1, Math.ceil(this.blob.size / server.partSize));
    return Array.from({ length: count }, (_, index) => index + 1).filter(
      (partNumber) => !server.sentParts.has(partNumber),
    );
  }

  /** Fresh URLs when they expired or soon will; parts in flight share one refresh. */
  private async ensureFreshUrls(
    server: ServerUpload,
    partNumbers: number[] | undefined,
    signal: AbortSignal,
  ) {
    if (!server.hasStaleUrls && !isUrlExpiring(server.urlsValidUntil, this.transport.now())) {
      return;
    }
    this.refreshing ??= this.transport
      .refresh(server.mediaId, partNumbers, signal)
      .then((target) => this.applyFreshUrls(server, target))
      .finally(() => {
        this.refreshing = null;
      });
    await this.refreshing;
  }

  private applyFreshUrls(server: ServerUpload, target: UploadTarget) {
    if (server.type === MediaKind.Image && target.type === MediaKind.Image) {
      server.url = target.presignedUrl;
    } else if (server.type === MediaKind.Video && target.type === MediaKind.Video) {
      for (const part of target.parts) {
        server.partUrls.set(part.partNumber, part.presignedUrl);
      }
    } else {
      throw new UploadFailure(FailureKind.Rejected, `fresh URLs for a ${target.type}`);
    }
    server.urlsValidUntil = this.urlsValidUntil();
    server.hasStaleUrls = false;
  }

  private urlsValidUntil() {
    return this.transport.now() + UPLOAD_URL_LIFETIME_MS;
  }
}
