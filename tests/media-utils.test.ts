import { describe, expect, it } from 'vitest';

import {
  MediaKind,
  type PickedMedia,
  refusePicked,
  RejectReason,
} from '@/features/media/media-utils';

describe('refusePicked', () => {
  const none = { [MediaKind.Image]: 0, [MediaKind.Video]: 0 };
  const photo: PickedMedia = { kind: MediaKind.Image, problem: null };
  const video: PickedMedia = { kind: MediaKind.Video, problem: null };

  it('takes photos up to ten and one video, in the order picked', () => {
    const reasons = refusePicked([video, ...Array(11).fill(photo), video], none);

    expect(reasons.slice(0, 11)).toEqual(Array(11).fill(null));
    expect(reasons[11]).toBe(RejectReason.TooManyImages);
    expect(reasons[12]).toBe(RejectReason.TooManyVideos);
  });

  it('counts what the draft already holds', () => {
    const reasons = refusePicked([photo, photo], { [MediaKind.Image]: 9, [MediaKind.Video]: 1 });
    expect(reasons).toEqual([null, RejectReason.TooManyImages]);
  });

  it('refuses a file for its own reason before counting, so it takes no slot', () => {
    const picked = [
      ...Array(9).fill(photo),
      { kind: MediaKind.Image, problem: RejectReason.UnsupportedImageFormat },
      { kind: MediaKind.Image, problem: RejectReason.Unreadable },
      photo,
    ];

    expect(refusePicked(picked, none).slice(9)).toEqual([
      RejectReason.UnsupportedImageFormat,
      RejectReason.Unreadable,
      null,
    ]);
  });
});
