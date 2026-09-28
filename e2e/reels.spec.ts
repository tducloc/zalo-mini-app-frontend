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
const pager = (page: Page) => page.locator('[data-reels-pager]');
const pagerPosition = (page: Page) => pager(page).evaluate((element) => element.scrollLeft);

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

test('starts with sound from the tab tap and comes back to the same reel', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.muted && !document.documentElement.dataset.firstAudibleHost) {
        document.documentElement.dataset.firstAudibleHost = this.closest('[data-reel-index="0"]')
          ? 'reel'
          : 'outside';
      }
      return play.call(this);
    };
  });
  const prefetched = page.waitForResponse(
    (response) => new URL(response.url()).pathname.endsWith('/api/v1/reels') && response.ok(),
  );
  await page.goto('/');
  await prefetched;
  await tab(page, 'Reels').click();
  const tabPositions = await page.evaluate(async () => {
    const positions: number[] = [];
    for (let frame = 0; frame < 24; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const tabbar = document.querySelector('nav[aria-label="Điều hướng chính"]');
      if (tabbar) positions.push(tabbar.getBoundingClientRect().left);
    }
    return positions;
  });
  expect(tabPositions.length).toBeGreaterThan(0);
  expect(Math.max(...tabPositions.map(Math.abs))).toBeLessThan(2);
  await expect(tab(page, 'Reels')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('html')).toHaveAttribute('data-first-audible-host', 'reel');

  await expectPlaying(video(page, 0));
  await expect(reel(page, 0).getByRole('button', { name: 'Xem chi tiết' })).toBeVisible();
  expect(await video(page, 0).evaluate((element: HTMLVideoElement) => element.muted)).toBe(false);
  await expect(reel(page, 0).getByRole('button', { name: 'Tắt âm thanh' })).toBeVisible();

  await reel(page, 1).evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expectPlaying(video(page, 1));
  await expectOnlyNearbyVideos(page, 0);

  const title = await reel(page, 1).getAttribute('aria-label');
  expect(title).toBeTruthy();
  await reel(page, 1).getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect.poll(() => pagerPosition(page)).toBeGreaterThan(300);
  await expect(page.getByRole('heading', { level: 1, name: title ?? '' })).toBeVisible();
  expect(await video(page, 1).evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);

  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect.poll(() => pagerPosition(page)).toBe(0);
  await expect(tab(page, 'Reels')).toHaveAttribute('aria-current', 'page');
  await expect(reel(page, 1)).toBeInViewport({ ratio: 0.9 });
  await expectPlaying(video(page, 1));
  await expectOnlyNearbyVideos(page, 0);

  await tab(page, 'Trang chủ').click();
  await tab(page, 'Reels').click();
  await expect(reel(page, 1)).toBeInViewport({ ratio: 0.9 });
  await expectPlaying(video(page, 1));
  expect(await video(page, 1).evaluate((element: HTMLVideoElement) => element.muted)).toBe(false);
});

test('starts muted when the first reel is not ready at the tab tap', async ({ page }) => {
  await page.route('**/api/v1/reels?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto('/');
  await tab(page, 'Reels').click();
  await expectPlaying(video(page, 0));
  expect(await video(page, 0).evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
});

/** A one-finger swipe of about 150 ms through the browser's real touch input, in CSS pixels. */
async function swipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  onHalfway?: () => Promise<void>,
) {
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
    if (step === steps / 2) await onHalfway?.();
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
  await expect(pager(page).locator('footer')).toBeAttached();

  const { width, height } = page.viewportSize() ?? { width: 412, height: 839 };
  const middle = height / 2;
  await swipe(page, { x: width * 0.8, y: middle }, { x: width * 0.2, y: middle }, async () => {
    const left = await pagerPosition(page);
    expect(left).toBeGreaterThan(width * 0.2);
    expect(left).toBeLessThan(width * 0.8);
    const tabLeft = await page
      .getByRole('navigation', { name: 'Điều hướng chính' })
      .evaluate((element) => element.getBoundingClientRect().left);
    expect(Math.abs(tabLeft + left)).toBeLessThan(3);
    const contactPosition = await pager(page)
      .locator('footer')
      .evaluate((element) => {
        const detailPanel = element.closest('[data-reels-pager] > div');
        return {
          position: getComputedStyle(element).position,
          offset:
            element.getBoundingClientRect().left - (detailPanel?.getBoundingClientRect().left ?? 0),
        };
      });
    expect(contactPosition.position).toBe('absolute');
    expect(Math.abs(contactPosition.offset)).toBeLessThan(3);
  });
  await expect.poll(() => pagerPosition(page)).toBeGreaterThan(width * 0.9);
  const heading = page.getByRole('heading', { level: 1, name: title ?? '' });
  await expect(heading).toBeVisible();

  // The gallery turns its photo while the pager stays on the detail panel.
  const counter = page.getByLabel(/^Nội dung \d+ trên \d+$/);
  await expect(counter).toHaveText(/^1 \//);
  await swipe(page, { x: width * 0.3, y: 150 }, { x: width * 0.9, y: 150 });
  await expect(counter).not.toHaveText(/^1 \//);
  await expect.poll(() => pagerPosition(page)).toBeGreaterThan(width * 0.9);
  await expect(heading).toBeVisible();

  // Below the gallery (square, full width), away from the edge.
  const belowGallery = width + 60;
  await swipe(page, { x: width * 0.25, y: belowGallery }, { x: width * 0.85, y: belowGallery });
  await expect.poll(() => pagerPosition(page)).toBe(0);
  await expect(tab(page, 'Reels')).toHaveAttribute('aria-current', 'page');
  await expect(reel(page, 0)).toBeInViewport({ ratio: 0.9 });
  await expectPlaying(video(page, 0));

  await tab(page, 'Trang chủ').click();
  await tab(page, 'Reels').click();
  await page.waitForTimeout(500);
  expect(await pagerPosition(page)).toBe(0);
  await expect(reel(page, 0)).toBeInViewport({ ratio: 0.9 });
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
  await expect(
    page.locator('[data-reels-pager] > div:first-child video, [data-reel-video-parking] video'),
  ).toHaveCount(3);
});
