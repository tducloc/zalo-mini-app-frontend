import type { ProductFeedPage } from '@/features/products/types/product';

// Its own entry, so Zalo runs it from listSyncJS while the main script is still downloading: the
// feed request, the first card images and the connection to the media CDN start before the app
// code runs. app.ts imports it too, so it also runs where only the main entry loads.
const feedBase = import.meta.env.VITE_API_BASE_URL;
const mediaOrigin = import.meta.env.VITE_MEDIA_ORIGIN;

function addLink(rel: string, href: string, isHighPriority = false) {
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (rel === 'preload') {
    link.as = 'image';
  }
  if (isHighPriority) {
    link.fetchPriority = 'high';
  }
  document.head.appendChild(link);
}

if (mediaOrigin) {
  addLink('preconnect', mediaOrigin);
}

if (feedBase && !window.__feedPrefetch) {
  const url = `${feedBase.replace(/\/$/, '')}/products?sortBy=publishedAt&order=desc&limit=20`;
  window.__feedPrefetch = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error('feed');
      }
      return response.json();
    })
    .then((page: ProductFeedPage) => {
      const cards = page?.data ?? [];
      for (const [index, card] of cards.slice(0, 2).entries()) {
        if (card?.thumbnailUrl) {
          addLink('preload', card.thumbnailUrl, index === 0);
        }
      }
      return page;
    });
}
