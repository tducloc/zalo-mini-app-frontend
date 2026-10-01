import { getSystemInfo } from 'zmp-sdk';

import { videoAccept } from '@/features/media/constants/formats';
import { VideoFormat } from '@/features/media/types/video';

vi.mock('zmp-sdk', () => ({
  getSystemInfo: vi.fn(),
}));

const both = `${VideoFormat.Mp4},${VideoFormat.QuickTime}`;

it('offers MOV on iOS and MP4 only on Android', () => {
  vi.mocked(getSystemInfo).mockReturnValue({ platform: 'iOS' } as ReturnType<typeof getSystemInfo>);
  expect(videoAccept()).toBe(both);

  vi.mocked(getSystemInfo).mockReturnValue({ platform: 'android' } as ReturnType<
    typeof getSystemInfo
  >);
  expect(videoAccept()).toBe(VideoFormat.Mp4);
});

it('keeps MOV selectable when Zalo does not say which phone this is', () => {
  vi.mocked(getSystemInfo).mockImplementation(() => {
    throw new Error('outside Zalo');
  });
  expect(videoAccept()).toBe(both);
});
