/**
 * Every way an upload step can fail, as one error type, and which of them another attempt
 * can fix (diagram 05). The API and storage calls turn their failures into these.
 */

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
  /** `detail` says what happened, or is the error that caused it. */
  constructor(
    readonly kind: FailureKind,
    detail: string | unknown,
  ) {
    super(`${kind}: ${detail instanceof Error ? detail.message : String(detail)}`);
    this.name = 'UploadFailure';
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
  // The multipart upload is gone (NoSuchUpload), e.g. aborted by the 1-day lifecycle rule.
  if (status === 404) {
    return FailureKind.Gone;
  }
  // S3 answers 400 RequestTimeout when the body stops arriving, which a weak uplink does.
  // A presigned PUT has nothing else the client could get wrong on a later attempt, and
  // the attempt limit ends a 400 that keeps coming.
  if (status === 400 || isTemporaryStatus(status)) {
    return FailureKind.Server;
  }
  return FailureKind.Rejected;
}

export const isRetryable = (kind: FailureKind) => kind !== FailureKind.Rejected;
