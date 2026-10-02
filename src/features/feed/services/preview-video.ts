import { VideoPool } from '@/features/reels/services/video-pool';

/**
 * The one <video> element every feed preview plays in, made at app start like the Reels one.
 * iOS refused a new element per card, even muted. Kept apart from Reels so a preview never
 * takes the element Reels plays with sound.
 */
export const previewVideoPool = new VideoPool();
