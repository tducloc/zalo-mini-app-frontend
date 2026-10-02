import type { ProductFeedPage } from '@/features/products/types/product';

// Built as its own chunk (vite.config.mts). Zalo lists it in `listAsyncJS` and runs it as
// soon as it arrives, while the app bundle is still downloading, so the feed and the first
// card photos load in parallel with the app. Keep it free of runtime imports.
const feedBase = import.meta.env.VITE_API_BASE_URL;

if (feedBase && !window.__feedPrefetch) {
  const url = `${feedBase.replace(/\/$/, '')}/products?sortBy=publishedAt&order=desc&limit=20`;

  window.__feedPrefetch = fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error('feed');
    }

    const page = (await response.json()) as ProductFeedPage;

    for (const [index, card] of page.data.slice(0, 2).entries()) {
      if (!card.thumbnailUrl) {
        continue;
      }

      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = card.thumbnailUrl;
      if (index === 0) {
        link.fetchPriority = 'high';
      }
      document.head.appendChild(link);
    }

    return page;
  });
}
