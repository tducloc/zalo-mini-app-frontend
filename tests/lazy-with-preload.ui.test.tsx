import { type ReactNode, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { lazyWithPreload } from '@/utils/lazy-with-preload';

const Page = () => <p>page</p>;

/** What one synchronous render shows, as the Reels tab tap does with flushSync. */
function renderInOnePass(element: ReactNode) {
  const container = document.createElement('div');
  const root = createRoot(container);
  flushSync(() => root.render(<Suspense fallback={<p>loading</p>}>{element}</Suspense>));
  return container.textContent;
}

describe('lazyWithPreload', () => {
  it('renders the page in the same pass once preloaded', async () => {
    const LazyPage = lazyWithPreload(async () => ({ default: Page }));

    await LazyPage.preload();

    expect(LazyPage.isLoaded()).toBe(true);
    expect(renderInOnePass(<LazyPage />)).toBe('page');
  });

  it('suspends when not preloaded, then loads on its own', async () => {
    const LazyPage = lazyWithPreload(async () => ({ default: Page }));

    expect(LazyPage.isLoaded()).toBe(false);
    expect(renderInOnePass(<LazyPage />)).toBe('loading');
    await vi.waitFor(() => expect(LazyPage.isLoaded()).toBe(true));
  });
});
