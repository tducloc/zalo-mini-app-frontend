/** How uploads retry, and how long an upload URL works. */

import type { Options as RetryOptions } from 'p-retry';

/** Attempts per file before the seller is asked; the first try counts (decided 2026-09-24). */
export const MAX_UPLOAD_ATTEMPTS = 3;

/**
 * Wait before attempt n+1: doubling from 1 s, times a random 1–2, so phones that lost the
 * network together do not all come back in the same second (1–2 s, then 2–4 s).
 */
export const RETRY_TIMING: Pick<RetryOptions, 'minTimeout' | 'factor' | 'randomize'> = {
  minTimeout: 1_000,
  factor: 2,
  randomize: true,
};

/**
 * How long a presigned URL works (api-spec: 15 minutes). The client counts it on its own
 * clock from when the URL arrived, instead of comparing the server's `expiresAt` with the
 * phone's clock, which can be minutes off.
 */
export const UPLOAD_URL_LIFETIME_MS = 15 * 60_000;
