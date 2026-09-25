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

import { MediaKind } from '@/features/media/media-utils';
import {
  FailureKind,
  isRetryable,
  isUrlExpiring,
  MAX_UPLOAD_ATTEMPTS,
  RETRY_TIMING,
  UPLOAD_URL_LIFETIME_MS,
  UploadFailure,
} from '@/features/media/upload/retry-policy';
import type {
  CompletedPart,
  ServerMediaStatus,
  UploadRequestFile,
  UploadTarget,
} from '@/features/media/upload/upload-types';

/** Parts of one video in flight at once (api-spec: "at most 3 at once"). */
const PARTS_IN_FLIGHT = 3;

export interface PutOptions {
  /** Sent as Content-Type; photos must send the declared type, which the URL signs. */
  contentType?: string;
  onProgress?: (sentBytes: number) => void;
  signal?: AbortSignal;
}

export interface UploadTransport {
  /** Not abortable: once the server has created the media, the caller must learn its ID. */
  register: (file: UploadRequestFile) => Promise<UploadTarget>;
  refresh: (
    mediaId: string,
    partNumbers: number[] | undefined,
    signal: AbortSignal,
  ) => Promise<UploadTarget>;
  put: (url: string, body: Blob, options: PutOptions) => Promise<string | null>;
  completeParts: (
    mediaId: string,
    parts: CompletedPart[],
    signal: AbortSignal,
  ) => Promise<ServerMediaStatus>;
  complete: (mediaId: string, signal: AbortSignal) => Promise<ServerMediaStatus>;
  isOnline: () => boolean;
  /** Resolves when the device is back online. */
  waitForNetwork: (signal: AbortSignal) => Promise<void>;
  now: () => number;
}

export enum UploadWait {
  Network = 'NETWORK',
  Retry = 'RETRY',
}

export interface UploadListener {
  /** The server created the media; also after a removal, so it can be deleted. */
  onRegistered: (mediaId: string) => void;
  /** Share of the file's bytes in storage, 0–1. */
  onProgress: (fraction: number) => void;
  onWaiting: (wait: UploadWait) => void;
  /** The next attempt starts after a wait. */
  onResumed: () => void;
}

export type UploadResult =
  | { kind: 'uploaded'; mediaId: string; status: ServerMediaStatus }
  | { kind: 'failed'; failure: FailureKind; isRetryable: boolean };

/** Bytes in 1-based part `partNumber` of a `size`-byte file cut in `partSize` pieces. */
function partBytes(size: number, partSize: number, partNumber: number) {
  return Math.min(partSize, size - (partNumber - 1) * partSize);
}

export class FileUpload {
  #mediaId: string | null = null;
  /** On the client's clock; see UPLOAD_URL_LIFETIME_MS. */
  private urlsValidUntil = 0;
  private hasStaleUrls = false;
  private photoUrl: string | null = null;
  private partSize = 0;
  private readonly partUrls = new Map<number, string>();
  private refreshing: Promise<void> | null = null;

  /** ETag of each part storage has, by part number. */
  private readonly sentParts = new Map<number, string>();
  /** The whole file is in storage (the PUT, or parts/complete, succeeded). */
  private isStored = false;

  constructor(
    private readonly request: UploadRequestFile,
    private readonly blob: Blob,
    private readonly transport: UploadTransport,
    /** The waits between attempts; tests pass none. */
    private readonly retryTiming = RETRY_TIMING,
  ) {}

  /** The server's ID once registered; it changes if the server lost the first one. */
  get mediaId() {
    return this.#mediaId;
  }

  /** The seller taps Retry: start with fresh URLs, as diagram 05 draws it. */
  markUrlsStale() {
    this.hasStaleUrls = true;
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
      return { kind: 'failed', failure: error.kind, isRetryable: isRetryable(error.kind) };
    }
  }

  private async attempt(listener: UploadListener, signal: AbortSignal): Promise<UploadResult> {
    if (!this.#mediaId) {
      this.applyTarget(await this.transport.register(this.request));
      listener.onRegistered(this.requireMediaId());
      signal.throwIfAborted();
    }

    if (!this.isStored) {
      await (this.request.type === MediaKind.Video
        ? this.sendParts(listener, signal)
        : this.sendPhoto(listener, signal));
    }

    return {
      kind: 'uploaded',
      mediaId: this.requireMediaId(),
      status: await this.complete(signal),
    };
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
    if (kind === FailureKind.Gone) {
      this.forgetServerState();
    }
    if (kind === FailureKind.Expired) {
      this.hasStaleUrls = true;
    }
  }

  /** The server no longer has the media: register again and send everything. */
  private forgetServerState() {
    this.#mediaId = null;
    this.urlsValidUntil = 0;
    this.hasStaleUrls = false;
    this.photoUrl = null;
    this.partUrls.clear();
    this.sentParts.clear();
    this.isStored = false;
  }

  private async complete(signal: AbortSignal) {
    try {
      return await this.transport.complete(this.requireMediaId(), signal);
    } catch (error) {
      if (error instanceof UploadFailure && error.kind === FailureKind.Conflict) {
        // Storage does not have the whole file after all. A photo is simply sent again; a
        // video's parts may no longer join, so it starts over as a new media.
        if (this.request.type === MediaKind.Video) {
          this.forgetServerState();
        } else {
          this.isStored = false;
        }
      }
      throw error;
    }
  }

  private async sendPhoto(listener: UploadListener, signal: AbortSignal) {
    await this.ensureFreshUrls(undefined, signal);
    if (!this.photoUrl) {
      throw new UploadFailure(FailureKind.Rejected, 'no upload URL for the photo');
    }

    await this.transport.put(this.photoUrl, this.blob, {
      contentType: this.request.contentType,
      signal,
      onProgress: (sent) => listener.onProgress(sent / this.blob.size),
    });
    this.isStored = true;
  }

  private async sendParts(listener: UploadListener, signal: AbortSignal) {
    if (!this.partSize) {
      throw new UploadFailure(FailureKind.Rejected, 'no part size for the video');
    }
    await this.sendUnsentParts(listener, signal);
    await this.joinParts(signal);
    this.isStored = true;
  }

  /** PARTS_IN_FLIGHT at a time; one failed part stops the others and fails the attempt. */
  private async sendUnsentParts(listener: UploadListener, signal: AbortSignal) {
    const inFlight = new Map<number, number>();
    const reportProgress = () => listener.onProgress(this.storedBytes(inFlight) / this.blob.size);

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
        await this.sendPart(partNumber, attemptController.signal, (sent) => {
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

    await pLimit(PARTS_IN_FLIGHT).map(this.unsentParts(), sendOne);
    signal.removeEventListener('abort', stopAll);

    signal.throwIfAborted();
    if (firstFailure) {
      throw firstFailure;
    }
  }

  /** Bytes of the parts storage has, plus those on their way. */
  private storedBytes(inFlight: Map<number, number>) {
    let bytes = 0;
    for (const partNumber of this.sentParts.keys()) {
      bytes += partBytes(this.blob.size, this.partSize, partNumber);
    }
    for (const sent of inFlight.values()) {
      bytes += sent;
    }
    return bytes;
  }

  private async joinParts(signal: AbortSignal) {
    const parts = [...this.sentParts]
      .map(([partNumber, etag]) => ({ partNumber, etag }))
      .sort((a, b) => a.partNumber - b.partNumber);
    await this.transport.completeParts(this.requireMediaId(), parts, signal);
  }

  private async sendPart(
    partNumber: number,
    signal: AbortSignal,
    onProgress: (sent: number) => void,
  ) {
    await this.ensureFreshUrls(this.unsentParts(), signal);
    const url = this.partUrls.get(partNumber);
    if (!url) {
      throw new UploadFailure(FailureKind.Rejected, `no upload URL for part ${partNumber}`);
    }

    const start = (partNumber - 1) * this.partSize;
    const body = this.blob.slice(
      start,
      start + partBytes(this.blob.size, this.partSize, partNumber),
    );
    const etag = await this.transport.put(url, body, { signal, onProgress });
    if (!etag) {
      // parts/complete needs every ETag; the bucket's CORS must expose it.
      throw new UploadFailure(FailureKind.Rejected, `storage hid the ETag of part ${partNumber}`);
    }
    this.sentParts.set(partNumber, etag);
  }

  private unsentParts() {
    const count = Math.max(1, Math.ceil(this.blob.size / this.partSize));
    return Array.from({ length: count }, (_, index) => index + 1).filter(
      (partNumber) => !this.sentParts.has(partNumber),
    );
  }

  /** Fresh URLs when they expired or soon will; parts in flight share one refresh. */
  private async ensureFreshUrls(partNumbers: number[] | undefined, signal: AbortSignal) {
    if (!this.hasStaleUrls && !isUrlExpiring(this.urlsValidUntil, this.transport.now())) {
      return;
    }
    this.refreshing ??= this.transport
      .refresh(this.requireMediaId(), partNumbers, signal)
      .then((target) => {
        this.applyTarget(target);
        this.hasStaleUrls = false;
      })
      .finally(() => {
        this.refreshing = null;
      });
    await this.refreshing;
  }

  private applyTarget(target: UploadTarget) {
    this.#mediaId = target.mediaId;
    this.urlsValidUntil = this.transport.now() + UPLOAD_URL_LIFETIME_MS;
    this.photoUrl = target.presignedUrl ?? this.photoUrl;
    this.partSize = target.partSize ?? this.partSize;
    for (const part of target.parts ?? []) {
      this.partUrls.set(part.partNumber, part.presignedUrl);
    }
  }

  private requireMediaId() {
    if (!this.#mediaId) {
      throw new UploadFailure(FailureKind.Gone, 'not registered');
    }
    return this.#mediaId;
  }
}
