import { describe, expect, it } from 'vitest';

import { convertedVideoSize } from '@/features/media/video/convert-video';

describe('convertedVideoSize', () => {
  it('brings the short side to 720 and keeps the shape', () => {
    expect(convertedVideoSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
    expect(convertedVideoSize(3840, 2160)).toEqual({ width: 1280, height: 720 });
  });

  it('rounds to even sides and never upscales', () => {
    expect(convertedVideoSize(1080, 1350)).toEqual({ width: 720, height: 900 });
    expect(convertedVideoSize(1440, 1080)).toEqual({ width: 960, height: 720 });
    expect(convertedVideoSize(480, 853)).toEqual({ width: 480, height: 854 });
  });
});
