import type { ProductFeedPage } from '@/features/products/types/product';

// This file is the script Zalo loads first. It must stay free of the app graph so the
// feed request starts before React and zmp-ui are evaluated.
const feedBase = import.meta.env.VITE_API_BASE_URL;

if (feedBase && !window.__feedPrefetch) {
  const url = `${feedBase.replace(/\/$/, '')}/products?sortBy=publishedAt&order=desc&limit=20`;

  window.__feedPrefetch = fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error('feed');
    }

    const page = (await response.json()) as ProductFeedPage;
    const cards = page.data ?? [];

    for (const [index, card] of cards.slice(0, 2).entries()) {
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

void import('./app');
