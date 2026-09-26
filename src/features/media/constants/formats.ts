/** The pickers' `accept` lists: the formats the app takes. */

import { ImageFormat } from '@/features/media/types/image';
import { VideoFormat } from '@/features/media/types/video';

/** The photo picker's `accept`: iOS then hands over a HEIC photo as JPEG. */
export const PHOTO_ACCEPT = Object.values(ImageFormat).join(',');

/** The video picker's `accept`. */
export const VIDEO_ACCEPT = Object.values(VideoFormat).join(',');
