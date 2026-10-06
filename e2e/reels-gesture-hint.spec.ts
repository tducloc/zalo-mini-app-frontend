import type { Locator, Page } from '@playwright/test';

import { expect, isReelsPageLoaded, tab, test } from './support';

const hint = (page: Page) => page.getByRole('dialog', { name: 'Hướng dẫn lướt video' });
const firstVideo = (page: Page) => page.locator('section[data-reel-index="0"] video');
const scroller = (page: Page) => page.locator('section[data-reel-index="0"]').locator('..');

async function expectPlaying(video: Locator) {
  const timeOf = () => video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);
  const start = await timeOf();
  await expect.poll(timeOf).not.toBe(start);
}

async function openReels(page: Page) {
  const prefetched = page.waitForResponse(
    (response) => new URL(response.url()).pathname.endsWith('/api/v1/reels') && response.ok(),
  );
  await page.goto('/');
  await prefetched;
  await tab(page, 'Reels').click();
  await expect
    .poll(() =>
      page
        .locator('[data-reels-pager]')
        .evaluate((element) => element.getBoundingClientRect().left),
    )
    .toBe(0);
}

async function swipeUp(page: Page) {
  const { width, height } = page.viewportSize() ?? { width: 375, height: 812 };
  const cdp = await page.context().newCDPSession(page);
  const x = width / 2;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: height * 0.7 }],
  });
  for (let step = 1; step <= 8; step += 1) {
    const y = height * 0.7 - (height * 0.4 * step) / 8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('teaches the gestures once, over a reel that keeps playing with sound', async ({ page }) => {
  await openReels(page);

  await expect(hint(page)).toBeVisible();
  await expect(hint(page).getByRole('button', { name: 'Đóng hướng dẫn' })).toBeFocused();
  await expectPlaying(firstVideo(page));
  expect(await firstVideo(page).evaluate((element: HTMLVideoElement) => element.muted)).toBe(false);

  // A tap anywhere closes it, and the tap does not reach the reel's play/pause button.
  const { width } = page.viewportSize() ?? { width: 375, height: 812 };
  await page.mouse.click(width / 2, 120);
  await expect(hint(page)).toHaveCount(0);
  await expectPlaying(firstVideo(page));
  expect(await firstVideo(page).evaluate((element: HTMLVideoElement) => element.muted)).toBe(false);

  // A plain browser has no Zalo nativeStorage, so "seen" lasts for this page load only; the unit
  // test covers the next app session.
  await tab(page, 'Trang chủ').click();
  await tab(page, 'Reels').click();
  await expectPlaying(firstVideo(page));
  await expect(hint(page)).toHaveCount(0);
});

// A transform on the entering page would pin the fixed Reels pane to the page, not the screen.
test('keeps Reels on the screen through the tab switch, while the hint fades in', async ({
  page,
}) => {
  const prefetched = page.waitForResponse(
    (response) => new URL(response.url()).pathname.endsWith('/api/v1/reels') && response.ok(),
  );
  await page.goto('/');
  await prefetched;
  await expect.poll(() => isReelsPageLoaded(page)).toBe(true);

  const framesOffScreen = await tab(page, 'Reels').evaluate(async (button: HTMLButtonElement) => {
    button.click();
    const frames: number[] = [];
    for (let frame = 0; frame < 30; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const pane = document.querySelector<HTMLElement>('[data-reels-pager]');
      const box = pane?.getBoundingClientRect();
      const isOnScreen =
        pane?.offsetParent === null && box?.width === innerWidth && box.height === innerHeight;
      if (!isOnScreen) frames.push(frame);
    }
    return frames;
  });

  expect(framesOffScreen).toEqual([]);
  await expect(hint(page)).toBeVisible();
});

test('a swipe dismisses the hint, and the next swipe moves the reels', async ({ page }) => {
  await openReels(page);
  await expect(hint(page)).toBeVisible();

  await swipeUp(page);
  await expect(hint(page)).toHaveCount(0);

  await swipeUp(page);
  await expect
    .poll(() => scroller(page).evaluate((element) => element.scrollTop))
    .toBeGreaterThan(300);
});
