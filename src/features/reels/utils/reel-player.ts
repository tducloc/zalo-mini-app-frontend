export type PlayerStatus = 'loading' | 'playing' | 'paused' | 'blocked' | 'failed';

export type PlayerEvent =
  | { type: 'activated' }
  | { type: 'deactivated' }
  | { type: 'tapped' }
  | { type: 'playing' }
  | { type: 'waiting' }
  | { type: 'refused'; wasMuted: boolean }
  | { type: 'errored' };

export function isPlayRefused(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

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
    case 'playing':
      return status === 'loading' || status === 'blocked' ? 'playing' : status;
    case 'waiting':
      return status === 'playing' ? 'loading' : status;
    case 'refused':
      if (status !== 'loading') {
        return status;
      }
      return event.wasMuted ? 'blocked' : 'loading';
    case 'errored':
      return 'failed';
  }
}
