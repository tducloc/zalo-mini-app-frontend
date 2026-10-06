import type { Locator, Page } from '@playwright/test';

import { expect, isReelsPageLoaded, skipReelsGestureHint, tab, test } from './support';

const reel = (page: Page, index: number) => page.locator(`section[data-reel-index="${index}"]`);
const video = (page: Page, index: number) => reel(page, index).locator('video');
const pager = (page: Page) => page.locator('[data-reels-pager]');
const FRAME_MS = 16;

test.beforeEach(({ page }) => skipReelsGestureHint(page));

const waitForRouteSlideIn = (page: Page) =>
  expect
    .poll(() => pager(page).evaluate((element) => element.getBoundingClientRect().left))
    .toBe(0);

const reelsLoaded = (page: Page) =>
  page.waitForResponse(
    (response) => new URL(response.url()).pathname.endsWith('/api/v1/reels') && response.ok(),
  );

const pagerPosition = (page: Page) => pager(page).evaluate((element) => element.scrollLeft);

async function expectPlaying(target: Locator) {
  const timeOf = () => target.evaluate((element: HTMLVideoElement) => element.currentTime);
  await expect
    .poll(() => target.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);
  const start = await timeOf();
  await expect.poll(timeOf).not.toBe(start);
}

/** Neighbours show a poster. Only the reel on screen has the shared video. */
async function expectOnlyActiveVideo(page: Page, active: number) {
  await expect(video(page, active)).toHaveCount(1);
  if (active >= 1) {
    await expect(video(page, active - 1)).toHaveCount(0);
  }
  await expect(page.locator('video[src]')).toHaveCount(1);
}

test('starts with sound from the tab tap and comes back to the same reel', async ({ page }) => {
  await page.addInitScript(() => {
    // WebKit allows sound only from a play() made while the tap's handler runs.
    let isInTap = false;
    window.addEventListener('click', () => (isInTap = true), true);
    window.addEventListener('click', () => (isInTap = false));
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.muted && !document.documentElement.dataset.firstAudibleHost) {
        document.documentElement.dataset.firstAudibleHost = this.closest('[data-reel-index="0"]')
          ? 'reel'
          : 'outside';
        document.documentElement.dataset.firstAudibleInTap = String(isInTap);
      }
      return play.call(this);
    };
  });
  const prefetched = reelsLoaded(page);
  await page.goto('/');
  await prefetched;
  // A user taps Reels once Home has settled, and by then the app shell has loaded the Reels
  // code (after the load event). An earlier tap starts muted, as the next tests show.
  await expect.poll(() => isReelsPageLoaded(page)).toBe(true);
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
  await expect(page.locator('html')).toHaveAttribute('data-first-audible-in-tap', 'true');

  await expectPlaying(video(page, 0));
  await expect(reel(page, 0).getByRole('button', { name: 'Xem chi tiết' })).toBeVisible();
  expect(await video(page, 0).evaluate((element: HTMLVideoElement) => element.muted)).toBe(false);
  await expect(reel(page, 0).getByRole('button', { name: 'Tắt âm thanh' })).toBeVisible();

  await reel(page, 1).evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expectPlaying(video(page, 1));
  await expectOnlyActiveVideo(page, 1);

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
  await expectOnlyActiveVideo(page, 1);

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

test('starts muted when the Reels code has not loaded at the tab tap', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/src/pages/reels.tsx*', async (route) => {
    await held;
    await route.continue();
  });
  const prefetched = reelsLoaded(page);
  await page.goto('/');
  await prefetched;
  expect(await isReelsPageLoaded(page)).toBe(false);

  await tab(page, 'Reels').click();
  release();

  await expectPlaying(video(page, 0));
  expect(await video(page, 0).evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  await expect(reel(page, 0).getByRole('button', { name: 'Bật âm thanh' })).toBeVisible();
});

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
    await page.waitForTimeout(FRAME_MS);
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
  await waitForRouteSlideIn(page);

  const { width, height } = page.viewportSize() ?? { width: 412, height: 839 };
  const middle = height / 2;
  await swipe(page, { x: width * 0.8, y: middle }, { x: width * 0.2, y: middle }, async () => {
    const left = await pagerPosition(page);
    expect(left).toBeGreaterThan(width * 0.1);
    expect(left).toBeLessThan(width * 0.8);
    const drift = await pager(page).evaluate((element) => {
      const tabBar = document.querySelector('nav[aria-label="Điều hướng chính"]');
      const pane = element.firstElementChild;
      return (
        (tabBar?.getBoundingClientRect().left ?? Number.NaN) -
        (pane?.getBoundingClientRect().left ?? Number.NaN)
      );
    });
    expect(Math.abs(drift)).toBeLessThan(3);
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

  const counter = page.getByLabel(/^Nội dung \d+ trên \d+$/);
  await expect(counter).toHaveText(/^1 \//);
  // On the first photo a right swipe stays in the gallery instead of carrying the pager back.
  await swipe(page, { x: width * 0.3, y: 150 }, { x: width * 0.9, y: 150 });
  expect(await pagerPosition(page)).toBeGreaterThan(width * 0.9);
  await expect(counter).toHaveText(/^1 \//);
  await swipe(page, { x: width * 0.9, y: 150 }, { x: width * 0.3, y: 150 });
  await expect(counter).toHaveText(/^2 \//);
  await expect(heading).toBeVisible();

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

test('plays each reel past the first page with the same video element', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Reels').click();
  await expectPlaying(video(page, 0));
  const first = await video(page, 0).elementHandle();

  for (let index = 1; index <= 12; index += 1) {
    await reel(page, index).evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expectPlaying(video(page, index));
  }
  await expectOnlyActiveVideo(page, 12);
  expect(await video(page, 12).evaluate((element, start) => element === start, first)).toBe(true);
});
