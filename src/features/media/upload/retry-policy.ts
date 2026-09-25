/**
 * What an upload does after something fails (diagram 05): which failures are worth another
 * attempt, how long to wait before it, and how often to ask the server about processing.
 * Pure, so each decision is unit-tested.
 */

/** Attempts per file before the seller is asked; the first try counts (decided 2026-09-24). */
export const MAX_UPLOAD_ATTEMPTS = 3;

const FIRST_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 8_000;

const FIRST_POLL_DELAY_MS = 2_000;
const POLL_DELAY_GROWTH = 1.5;
const MAX_POLL_DELAY_MS = 15_000;

export enum FailureKind {
  /** No answer: offline, timed out, stalled, or the WebView was paused. */
  Network = 'NETWORK',
  /** The server or storage answered with a temporary error (5xx, 429). */
  Server = 'SERVER',
  /** Storage refused the URL: it expired (S3 answers 403). A fresh URL fixes it. */
  Expired = 'EXPIRED',
  /** The media is gone on the server (404), e.g. the hourly cleanup removed it. */
  Gone = 'GONE',
  /** The server does not allow this step now (409); what it means depends on the step. */
  Conflict = 'CONFLICT',
  /** Refused for good: a wrong size or type, or a CORS setup that hides the ETag. */
  Rejected = 'REJECTED',
}

export class UploadFailure extends Error {
  constructor(
    readonly kind: FailureKind,
    cause?: unknown,
  ) {
    super(`${kind}: ${cause instanceof Error ? cause.message : String(cause ?? '')}`);
  }
}

const isTemporaryStatus = (status: number) => status === 408 || status === 429 || status >= 500;

/** For an answer from the marketplace API; 0 means no answer. */
export function failureFromApiStatus(status: number) {
  if (status === 0) {
    return FailureKind.Network;
  }
  if (status === 404) {
    return FailureKind.Gone;
  }
  if (status === 409) {
    return FailureKind.Conflict;
  }
  // A 401 here means the session could not be renewed; it may be back by the next try.
  if (status === 401 || isTemporaryStatus(status)) {
    return FailureKind.Server;
  }
  return FailureKind.Rejected;
}

/** For an answer from a presigned PUT to storage; 0 means no answer. */
export function failureFromStorageStatus(status: number) {
  if (status === 0) {
    return FailureKind.Network;
  }
  // S3 answers 403 both for an expired URL and a wrong signature; a fresh URL fixes the
  // first, and the attempt limit ends the second.
  if (status === 403) {
    return FailureKind.Expired;
  }
  if (isTemporaryStatus(status)) {
    return FailureKind.Server;
  }
  return FailureKind.Rejected;
}

export const isRetryable = (kind: FailureKind) => kind !== FailureKind.Rejected;

/**
 * Wait before the next attempt, after attempt `attempt` (1-based) failed: doubles each time,
 * with jitter over the upper half, so phones that lost the network together do not all
 * come back in the same second.
 */
export function retryDelayMs(attempt: number, random: number) {
  const ceiling = Math.min(MAX_RETRY_DELAY_MS, FIRST_RETRY_DELAY_MS * 2 ** (attempt - 1));
  return Math.round(ceiling / 2 + (random * ceiling) / 2);
}

/** Wait before status poll `round` (0-based): quick at first, less often as time passes. */
export function pollDelayMs(round: number) {
  return Math.min(MAX_POLL_DELAY_MS, Math.round(FIRST_POLL_DELAY_MS * POLL_DELAY_GROWTH ** round));
}

/** Refresh a URL this close to its expiry rather than start a request that may outlive it. */
export const URL_EXPIRY_MARGIN_MS = 60_000;

export function isUrlExpiring(expiresAt: string, now: number) {
  const expiry = Date.parse(expiresAt);
  return Number.isNaN(expiry) || expiry - now < URL_EXPIRY_MARGIN_MS;
}
