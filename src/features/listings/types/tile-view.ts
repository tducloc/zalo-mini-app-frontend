// Only failures (isFailed) are errors, with the tile's "!" badge. Waiting for the network
// is not: the app retries on its own, and a red mark would alarm the seller for nothing.
export enum TileTone {
  /** Checking, optimizing, uploading or processing: a spinner or a percentage. */
  Working = 'WORKING',
  /** Paused until the network is back; the app goes on by itself. */
  Waiting = 'WAITING',
  /** Needs the seller: retry or remove. */
  Error = 'ERROR',
  /** Ready on the server. */
  Done = 'DONE',
}

export interface TileView {
  tone: TileTone;
  /** The short line on the tile; null when the picture is enough. */
  label: string | null;
  /** 0–1 when there is a percentage to show. */
  progress: number | null;
  /** The full sentence in the viewer: why it failed, or what it waits for. */
  detail: string | null;
  canRetry: boolean;
  /** The optimized photo, or the server's thumbnail once it has one. */
  imageUrl: string | null;
}
