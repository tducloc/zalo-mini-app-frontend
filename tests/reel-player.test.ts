import {
  type PlayerEvent,
  type PlayerStatus,
  reelPlayer,
  shouldPlay,
} from '@/features/reels/utils/reel-player';

const run = (from: PlayerStatus, ...events: PlayerEvent[]) => events.reduce(reelPlayer, from);

const activated: PlayerEvent = { type: 'activated' };
const deactivated: PlayerEvent = { type: 'deactivated' };
const tapped: PlayerEvent = { type: 'tapped' };
const played: PlayerEvent = { type: 'played' };
const stalled: PlayerEvent = { type: 'stalled' };
const errored: PlayerEvent = { type: 'errored' };
const refusedWithSound: PlayerEvent = { type: 'refused', wasMuted: false };
const refusedMuted: PlayerEvent = { type: 'refused', wasMuted: true };

describe('reelPlayer', () => {
  it('loads when the reel comes on screen and plays once the video does', () => {
    expect(run('paused', activated)).toBe('loading');
    expect(run('paused', activated, played)).toBe('playing');
  });

  it('pauses when the reel leaves the screen, and plays again when it comes back', () => {
    expect(run('playing', deactivated)).toBe('paused');
    expect(run('playing', deactivated, activated)).toBe('loading');
  });

  it('keeps a playing reel playing when told again that it is on screen', () => {
    expect(run('playing', activated)).toBe('playing');
  });

  it('toggles between paused and playing on a tap', () => {
    expect(run('playing', tapped)).toBe('paused');
    expect(run('playing', tapped, tapped)).toBe('loading');
    expect(run('playing', tapped, tapped, played)).toBe('playing');
  });

  it('lets the viewer pause a video that is still loading', () => {
    expect(run('loading', tapped)).toBe('paused');
  });

  it('stays paused when a play started before the pause lands after it', () => {
    expect(run('loading', tapped, played)).toBe('paused');
  });

  it('shows loading while a playing video waits for data', () => {
    expect(run('playing', stalled)).toBe('loading');
    expect(run('playing', stalled, played)).toBe('playing');
    expect(run('paused', stalled)).toBe('paused');
  });

  describe('a refused play', () => {
    it('with sound keeps loading, for one more try muted', () => {
      expect(run('loading', refusedWithSound)).toBe('loading');
    });

    it('when muted too, blocks until the viewer taps', () => {
      expect(run('loading', refusedWithSound, refusedMuted)).toBe('blocked');
      expect(run('loading', refusedMuted)).toBe('blocked');
    });

    it('is played by a tap, a user gesture', () => {
      expect(run('blocked', tapped)).toBe('loading');
      expect(run('blocked', tapped, played)).toBe('playing');
    });

    it('is ignored once the viewer paused', () => {
      expect(run('paused', refusedMuted)).toBe('paused');
    });

    it('is tried again when the reel comes back on screen', () => {
      expect(run('blocked', deactivated, activated)).toBe('loading');
    });
  });

  it('fails on a video error, and stays failed whatever happens next', () => {
    expect(run('playing', errored)).toBe('failed');
    for (const event of [activated, deactivated, tapped, played, stalled, refusedMuted]) {
      expect(run('failed', event)).toBe('failed');
    }
  });
});

describe('shouldPlay', () => {
  it('wants the video playing only while loading or playing', () => {
    const statuses: PlayerStatus[] = ['loading', 'playing', 'paused', 'blocked', 'failed'];

    expect(statuses.filter(shouldPlay)).toEqual(['loading', 'playing']);
  });
});
