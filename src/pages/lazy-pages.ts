import { lazyWithPreload } from 'react-lazy-with-preload';

// Each screen here is its own chunk, kept out of the first script. AppShell preloads them all
// after the window's load event. Once preloaded, a screen renders without suspending: a plain
// React.lazy suspends on its first render, and the routes' Suspense then blanks the screen.
export const ReelsPage = lazyWithPreload(() => import('@/pages/reels'));
export const MyListingsPage = lazyWithPreload(() => import('@/pages/my-listings'));
export const SellPage = lazyWithPreload(() => import('@/pages/sell'));
export const ProfilePage = lazyWithPreload(() => import('@/pages/profile'));
export const ProductDetailPage = lazyWithPreload(() => import('@/pages/product-detail'));
export const EditListingPage = lazyWithPreload(() => import('@/pages/edit-listing'));
export const FilterSheet = lazyWithPreload(
  () => import('@/features/feed/components/filters/filter-sheet'),
);

let isReelsLoaded = false;

export function preloadPages() {
  void ReelsPage.preload()
    .then(() => {
      isReelsLoaded = true;
    })
    .catch(() => undefined);

  for (const page of [
    MyListingsPage,
    SellPage,
    ProfilePage,
    ProductDetailPage,
    EditListingPage,
    FilterSheet,
  ]) {
    void page.preload().catch(() => undefined);
  }
}

// The Reels tab tap mounts the page inside the tap, where WebKit allows sound, so it needs
// the page's code already here.
export const isReelsPageLoaded = () => isReelsLoaded;
