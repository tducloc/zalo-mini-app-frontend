/**
 * The timing of uploads (diagram 05): how many attempts, how long to wait between them, how
 * often to ask the server about processing, and when a URL counts as expired. Pure, so each
 * decision is unit-tested. Which failures are worth another attempt: upload-failure.ts.
 */

/** Attempts per file before the seller is asked; the first try counts (decided 2026-09-24). */
export const MAX_UPLOAD_ATTEMPTS = 3;

const FIRST_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 8_000;

const FIRST_POLL_DELAY_MS = 2_000;
const POLL_DELAY_GROWTH = 1.5;
const MAX_POLL_DELAY_MS = 15_000;

/**
 * How long a presigned URL works (api-spec: 15 minutes). The client counts it on its own
 * clock from when the URL arrived, instead of comparing the server's `expiresAt` with the
 * phone's clock, which can be minutes off.
 */
export const UPLOAD_URL_LIFETIME_MS = 15 * 60_000;

/** Refresh a URL this close to its expiry rather than start a request that may outlive it. */
const URL_EXPIRY_MARGIN_MS = 60_000;

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

/** `validUntil` is on the client's clock: arrival time + UPLOAD_URL_LIFETIME_MS. */
export const isUrlExpiring = (validUntil: number, now: number) =>
  validUntil - now < URL_EXPIRY_MARGIN_MS;
