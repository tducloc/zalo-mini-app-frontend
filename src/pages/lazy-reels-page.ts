import { lazyWithPreload } from 'react-lazy-with-preload';

// The Reels tab tap mounts this page inside the tap, where WebKit allows sound, so the app
// shell loads it ahead. Once preloaded, the page renders without suspending.
export const LazyReelsPage = lazyWithPreload(() => import('@/pages/reels'));

let isLoaded = false;

export const preloadReelsPage = () =>
  LazyReelsPage.preload().then(() => {
    isLoaded = true;
  });

export const isReelsPageLoaded = () => isLoaded;
