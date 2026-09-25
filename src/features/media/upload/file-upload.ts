/**
 * Uploads one file and follows diagram 05 when it fails: photo in one PUT, video in 8 MB
 * parts 3 at a time, then `complete`. Remembers what already reached storage, so another
 * attempt, or the seller's Retry, sends only what is missing.
 *
 * The network comes in through UploadTransport, so the tests drive every failure.
 */

import { MediaKind } from '@/features/media/media-limits';
import type {
  CompletedPart,
  ServerMediaStatus,
  UploadRequestFile,
  UploadTarget,
} from '@/features/media/upload/upload-types';
import type { PutOptions } from '@/features/media/upload/put-blob';
import {
  FailureKind,
  isRetryable,
  isUrlExpiring,
  MAX_UPLOAD_ATTEMPTS,
  retryDelayMs,
  UploadFailure,
} from '@/features/media/upload/retry-policy';

/** Parts of one video in flight at once (api-spec: "at most 3 at once"). */
export const PARTS_IN_FLIGHT = 3;

export interface UploadTransport {
  register: (file: UploadRequestFile, signal: AbortSignal) => Promise<UploadTarget>;
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
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  random: () => number;
  now: () => number;
}

export enum UploadWait {
  Network = 'NETWORK',
  Retry = 'RETRY',
}

export interface UploadListener {
  /** Share of the file's bytes in storage, 0–1. */
  onProgress: (fraction: number) => void;
  onWaiting: (wait: UploadWait) => void;
  /** The next attempt starts after a wait. */
  onResumed: () => void;
}

export type UploadResult =
  | { kind: 'uploaded'; mediaId: string; status: ServerMediaStatus }
  | { kind: 'failed'; isRetryable: boolean };

/** Bytes in 1-based part `partNumber` of a `size`-byte file cut in `partSize` pieces. */
export function partBytes(size: number, partSize: number, partNumber: number) {
  return Math.min(partSize, size - (partNumber - 1) * partSize);
}

export class FileUpload {
  private mediaIdValue: string | null = null;
  private expiresAt = '';
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
  ) {}

  /** The server's ID once registered; it changes if the server lost the first one. */
  get mediaId() {
    return this.mediaIdValue;
  }

  /** Takes URLs from a registration made for several files at once. */
  assign(target: UploadTarget) {
    this.applyTarget(target);
  }

  /** Attempts until uploaded, refused for good, or out of attempts. Rejects only on abort. */
  async run(listener: UploadListener, signal: AbortSignal): Promise<UploadResult> {
    let attempt = 0;
    for (;;) {
      if (!this.transport.isOnline()) {
        // Offline is a pause, not a failure: it uses up no attempt (diagram 05).
        listener.onWaiting(UploadWait.Network);
        await this.transport.waitForNetwork(signal);
        listener.onResumed();
      }

      attempt += 1;
      try {
        return await this.attempt(listener, signal);
      } catch (error) {
        if (signal.aborted || !(error instanceof UploadFailure)) {
          throw error;
        }
        if (error.kind === FailureKind.Network && !this.transport.isOnline()) {
          attempt -= 1;
          continue;
        }

        this.recover(error.kind);
        if (!isRetryable(error.kind) || attempt >= MAX_UPLOAD_ATTEMPTS) {
          return { kind: 'failed', isRetryable: isRetryable(error.kind) };
        }
        listener.onWaiting(UploadWait.Retry);
        await this.transport.sleep(retryDelayMs(attempt, this.transport.random()), signal);
        listener.onResumed();
      }
    }
  }

  private async attempt(listener: UploadListener, signal: AbortSignal): Promise<UploadResult> {
    if (!this.mediaIdValue) {
      this.applyTarget(await this.transport.register(this.request, signal));
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

  /** Clears whatever the failure showed to be wrong, before the next attempt. */
  private recover(kind: FailureKind) {
    if (kind === FailureKind.Gone) {
      // The server no longer has the media: register again and send everything.
      this.mediaIdValue = null;
      this.partUrls.clear();
      this.sentParts.clear();
      this.isStored = false;
    }
    if (kind === FailureKind.Expired) {
      this.hasStaleUrls = true;
    }
  }

  private async complete(signal: AbortSignal) {
    try {
      return await this.transport.complete(this.requireMediaId(), signal);
    } catch (error) {
      if (error instanceof UploadFailure && error.kind === FailureKind.Conflict) {
        // Storage does not have the whole file after all: send it again.
        this.isStored = false;
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
    const queue = this.unsentParts();
    const inFlight = new Map<number, number>();
    const reportProgress = () => {
      let sent = 0;
      for (const partNumber of this.sentParts.keys()) {
        sent += partBytes(this.blob.size, this.partSize, partNumber);
      }
      for (const bytes of inFlight.values()) {
        sent += bytes;
      }
      listener.onProgress(sent / this.blob.size);
    };

    // One failed part stops the others, so the next attempt never overlaps this one.
    const attemptController = new AbortController();
    const stopAll = () => attemptController.abort(signal.reason);
    signal.addEventListener('abort', stopAll);
    let firstFailure: unknown = null;

    const sendNext = async () => {
      for (let partNumber = queue.shift(); partNumber; partNumber = queue.shift()) {
        try {
          await this.sendPart(partNumber, attemptController.signal, (sent) => {
            inFlight.set(partNumber, sent);
            reportProgress();
          });
          inFlight.delete(partNumber);
          reportProgress();
        } catch (error) {
          inFlight.delete(partNumber);
          firstFailure ??= error;
          attemptController.abort();
          return;
        }
      }
    };
    await Promise.all(Array.from({ length: PARTS_IN_FLIGHT }, sendNext));
    signal.removeEventListener('abort', stopAll);
    if (firstFailure) {
      throw firstFailure;
    }

    const parts = [...this.sentParts]
      .map(([partNumber, etag]) => ({ partNumber, etag }))
      .sort((a, b) => a.partNumber - b.partNumber);
    await this.transport.completeParts(this.requireMediaId(), parts, signal);
    this.isStored = true;
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
    if (!this.hasStaleUrls && !isUrlExpiring(this.expiresAt, this.transport.now())) {
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
    this.mediaIdValue = target.mediaId;
    this.expiresAt = target.expiresAt;
    this.photoUrl = target.presignedUrl ?? this.photoUrl;
    this.partSize = target.partSize ?? this.partSize;
    for (const part of target.parts ?? []) {
      this.partUrls.set(part.partNumber, part.presignedUrl);
    }
  }

  private requireMediaId() {
    if (!this.mediaIdValue) {
      throw new UploadFailure(FailureKind.Gone, 'not registered');
    }
    return this.mediaIdValue;
  }
}
