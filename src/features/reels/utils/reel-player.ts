/**
 * One reel's player (plans/reels.md, section 4). `loading` and `playing` want the video to
 * play; the others want it paused. `blocked` is a WebView that refused `play()` even muted:
 * a tap, being a user gesture, plays it. `failed` is final: the poster and a message stay.
 */
export type PlayerStatus = 'loading' | 'playing' | 'paused' | 'blocked' | 'failed';

export type PlayerEvent =
  /** It became the reel on screen. */
  | { type: 'activated' }
  /** It left the screen, or the app went to the background. */
  | { type: 'deactivated' }
  | { type: 'tapped' }
  /** The video's `playing` event. */
  | { type: 'played' }
  /** The video's `waiting` event: it ran out of data. */
  | { type: 'stalled' }
  /** `play()` rejected with NotAllowedError. An AbortError is not a refusal. */
  | { type: 'refused'; wasMuted: boolean }
  /** The video's `error` event. */
  | { type: 'errored' };

export function shouldPlay(status: PlayerStatus) {
  return status === 'loading' || status === 'playing';
}

export function reelPlayer(status: PlayerStatus, event: PlayerEvent): PlayerStatus {
  if (status === 'failed') {
    return status;
  }

  switch (event.type) {
    case 'activated':
      return status === 'playing' ? status : 'loading';
    case 'deactivated':
      return 'paused';
    case 'tapped':
      return shouldPlay(status) ? 'paused' : 'loading';
    case 'played':
      // A play that lands after the viewer paused does not override them.
      return status === 'loading' || status === 'blocked' ? 'playing' : status;
    case 'stalled':
      return status === 'playing' ? 'loading' : status;
    case 'refused':
      if (status !== 'loading') {
        return status;
      }
      // Refused with sound: still loading, the player mutes and tries once more.
      return event.wasMuted ? 'blocked' : 'loading';
    case 'errored':
      return 'failed';
  }
}
