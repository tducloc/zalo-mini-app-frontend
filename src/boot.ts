import type { ProductFeedPage } from '@/features/products/types/product';

// Loaded before the app (index.html) as its own chunk (vite.config.mts), so Zalo runs it while
// the main script is still downloading: the feed request, the first card images and the
// connection to the media CDN start before the app code runs.
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

// A static copy of Home's header (home-header.tsx, home.tsx), so the first paint does not wait
// for the main script. Inline styles: the stylesheet may not be loaded yet. React's first
// commit replaces it, since createRoot empties its container.
const SAFE_TOP = 'max(24px, var(--zaui-safe-area-inset-top, env(safe-area-inset-top, 0px)))';
const APP_SHELL_HTML = `
<header aria-hidden="true" style="position:fixed;inset:0 0 auto;z-index:30;box-sizing:border-box;height:calc(${SAFE_TOP} + 108px);padding:${SAFE_TOP} 16px 12px;background:#0068ff;color:#fff;font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
  <h1 style="display:flex;align-items:center;box-sizing:border-box;height:44px;margin:0 0 8px;padding-right:96px;font-size:22px;font-weight:700;line-height:28px;letter-spacing:-0.3px">Chợ Zalo</h1>
  <div style="display:flex;align-items:center;gap:8px">
    <div style="display:flex;flex:1;align-items:center;height:44px;padding:0 13px 0 46px;border-radius:10px;background:#fff;color:#9ca3af;font-size:15px">Tìm kiếm</div>
    <div style="flex:none;width:42px;height:42px"></div>
  </div>
</header>`;

const appRoot = document.getElementById('app');
if (appRoot && !appRoot.firstChild) {
  appRoot.innerHTML = APP_SHELL_HTML;
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
