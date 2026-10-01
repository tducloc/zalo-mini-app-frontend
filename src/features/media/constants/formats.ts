/** The pickers' `accept` lists: the formats the app takes. */

import { getSystemInfo } from 'zmp-sdk';

import { ImageFormat } from '@/features/media/types/image';
import { VideoFormat } from '@/features/media/types/video';

/** The photo picker's `accept`: iOS then hands over a HEIC photo as JPEG. */
export const PHOTO_ACCEPT = Object.values(ImageFormat).join(',');

const VIDEO_ACCEPT_IOS = `${VideoFormat.Mp4},${VideoFormat.QuickTime}`;

/**
 * Android keeps the library file, so the picker offers MP4 only. iOS records MOV and
 * exports H.264 when the clip is chosen, so MOV stays selectable there. Anywhere else
 * (a desktop browser) keeps MOV too.
 */
export function videoAccept() {
  try {
    if (getSystemInfo().platform === 'android') {
      return VideoFormat.Mp4;
    }
  } catch {
    // Outside Zalo the picker is the browser's. MOV stays selectable.
  }
  return VIDEO_ACCEPT_IOS;
}
