/**
 * What an upload does when something fails (diagram 05): when a URL counts as expired, and
 * which failures another attempt can fix (how many attempts and how long between them:
 * constants/upload.ts). Pure, so each decision is unit-tested.
 */

import { FailureKind } from '@/features/media/types/upload';

/** Refresh a URL this close to its expiry rather than start a request that may outlive it. */
const URL_EXPIRY_MARGIN_MS = 60_000;

/** `validUntil` is on the client's clock: arrival time + UPLOAD_URL_LIFETIME_MS. */
export const isUrlExpiring = (validUntil: number, now: number) =>
  validUntil - now < URL_EXPIRY_MARGIN_MS;

export class UploadFailure extends Error {
  /** `detail` says what happened, or is the error that caused it. */
  constructor(
    readonly kind: FailureKind,
    detail: unknown,
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
