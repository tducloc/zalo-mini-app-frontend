import { lazyWithPreload } from '@/utils/lazy-with-preload';

// The Reels tab tap mounts this page inside the tap, where WebKit allows sound, so the app
// shell loads it ahead.
export const LazyReelsPage = lazyWithPreload(() => import('@/pages/reels'));
