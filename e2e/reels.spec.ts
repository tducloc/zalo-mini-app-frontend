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

async function expectPaused(target: Locator) {
  await expect
    .poll(() => target.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);
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
  await expectPaused(video(page, 0));

  const title = await reel(page, 1).getAttribute('aria-label');
  expect(title).toBeTruthy();
  await reel(page, 1).getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title ?? '' })).toBeVisible();

  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect(tab(page, 'Reels')).toHaveAttribute('aria-current', 'page');
  await expect(reel(page, 1)).toBeInViewport({ ratio: 0.9 });
  await expectPlaying(video(page, 1));
  await expectPaused(video(page, 0));
});
