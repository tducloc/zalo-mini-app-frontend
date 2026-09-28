import type { Locator, Page } from '@playwright/test';

import { expect, tab, test } from './support';

/**
 * Reels against the real stack: needs at least two published listings with a ready video
 * (the seed has them). One video plays at a time, muted, and coming back from a listing's
 * detail finds the same reel on screen.
 */

// Reels only; the footer after the last one has the next index too.
const reel = (page: Page, index: number) => page.locator(`section[data-reel-index="${index}"]`);
const video = (page: Page, index: number) => reel(page, index).locator('video');

/** Playing: not paused, and its time moves (a looping clip may come round to the start). */
async function expectPlaying(target: Locator) {
  const timeOf = () => target.evaluate((element: HTMLVideoElement) => element.currentTime);
  await expect
    .poll(() => target.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);
  const start = await timeOf();
  await expect.poll(timeOf).not.toBe(start);
}

/** A reel left behind gives its video back to the pool: only the one on screen and the next hold one. */
async function expectOnlyNearbyVideos(page: Page, left: number) {
  await expect(video(page, left)).toHaveCount(0);
  await expect(page.locator('video[src]')).toHaveCount(2);
}

test('plays one reel at a time, muted, and comes back to it from the detail', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Reels').click();
  await expect(tab(page, 'Reels')).toHaveAttribute('aria-current', 'page');

  await expectPlaying(video(page, 0));
  expect(await video(page, 0).evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  await expect(reel(page, 0).getByRole('button', { name: 'Bật âm thanh' })).toBeVisible();

  await reel(page, 1).evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expectPlaying(video(page, 1));
  await expectOnlyNearbyVideos(page, 0);

  const title = await reel(page, 1).getAttribute('aria-label');
  expect(title).toBeTruthy();
  await reel(page, 1).getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title ?? '' })).toBeVisible();

  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect(tab(page, 'Reels')).toHaveAttribute('aria-current', 'page');
  await expect(reel(page, 1)).toBeInViewport({ ratio: 0.9 });
  await expectPlaying(video(page, 1));
  await expectOnlyNearbyVideos(page, 0);
});

/** A one-finger swipe of about 150 ms through the browser's real touch input, in CSS pixels. */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  const steps = 8;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let step = 1; step <= steps; step += 1) {
    const point = {
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    // A finger takes about a frame per step; the gallery's gesture reads the pace.
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('swipes left from a reel to its detail, and right below the gallery back to it', async ({
  page,
}) => {
  await page.goto('/');
  await tab(page, 'Reels').click();
  await expectPlaying(video(page, 0));
  const title = await reel(page, 0).getAttribute('aria-label');
  expect(title).toBeTruthy();

  const { width, height } = page.viewportSize() ?? { width: 412, height: 839 };
  const middle = height / 2;
  await swipe(page, { x: width * 0.8, y: middle }, { x: width * 0.2, y: middle });
  const heading = page.getByRole('heading', { level: 1, name: title ?? '' });
  await expect(heading).toBeVisible();

  // Across the gallery, away from the edge: the gallery turns (the seeded reels have photos
  // too), and the page stays.
  // Once the slide-in is over: until then the Reels page is still over the gallery.
  await expect(reel(page, 0)).toHaveCount(0);
  const counter = page.getByLabel(/^Nội dung \d+ trên \d+$/);
  await expect(counter).toHaveText(/^1 \//);
  await swipe(page, { x: width * 0.3, y: 150 }, { x: width * 0.9, y: 150 });
  await expect(counter).not.toHaveText(/^1 \//);
  await expect(heading).toBeVisible();

  // Below the gallery (square, full width), away from the edge.
  const belowGallery = width + 60;
  await swipe(page, { x: width * 0.25, y: belowGallery }, { x: width * 0.85, y: belowGallery });
  await expect(tab(page, 'Reels')).toHaveAttribute('aria-current', 'page');
  await expect(reel(page, 0)).toBeInViewport({ ratio: 0.9 });
  await expectPlaying(video(page, 0));
});

test('plays each reel past the first page with the same three video elements', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Reels').click();
  await expectPlaying(video(page, 0));

  // Past the first page of 10: iOS refuses elements made after the viewer's last touch.
  for (let index = 1; index <= 12; index += 1) {
    await reel(page, index).evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expectPlaying(video(page, index));
  }
  await expect(page.locator('video')).toHaveCount(3);
});
