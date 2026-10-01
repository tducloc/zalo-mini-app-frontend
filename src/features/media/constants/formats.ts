/** The pickers' `accept` lists: the formats the app takes. */

import { ImageFormat } from '@/features/media/types/image';
import { VideoFormat } from '@/features/media/types/video';

/** The photo picker's `accept`: iOS then hands over a HEIC photo as JPEG. */
export const PHOTO_ACCEPT = Object.values(ImageFormat).join(',');

/** MP4 and MOV. The worker delivers H.264 inside either container as MP4. */
export const VIDEO_ACCEPT = `${VideoFormat.Mp4},${VideoFormat.QuickTime}`;

