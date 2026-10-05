import type { Locator, Page } from '@playwright/test';

import { expect, skipReelsGestureHint, tab, test } from './support';

const SWIPE_STEPS = 10;
const FRAME_MS = 16;
const SETTLE_MS = 500;
const SWIPE_DISTANCE_PX = 250;
const MAX_FEED_SCROLLS = 30;
const FEED_SCROLL_PX = 700;
const FEED_SCROLL_WAIT_MS = 100;

const counter = (page: Page) => page.getByLabel(/^Nội dung \d+ trên \d+$/);
const galleryTrack = (page: Page) => page.locator('[data-gallery-track]');
const galleryVideo = (page: Page) => galleryTrack(page).locator('video');
const pager = (page: Page) => page.locator('[data-reels-pager]');

const isMuted = (video: Locator) => video.evaluate((element: HTMLVideoElement) => element.muted);
const isPaused = (video: Locator) => video.evaluate((element: HTMLVideoElement) => element.paused);

async function expectPlaying(video: Locator) {
  await expect.poll(() => isPaused(video)).toBe(false);
  const timeOf = () => video.evaluate((element: HTMLVideoElement) => element.currentTime);
  const start = await timeOf();
  await expect.poll(timeOf).not.toBe(start);
}

/** A finger drag with real touch events; `whileHeld` runs before the finger lifts. */
async function drag(
  page: Page,
  start: { x: number; y: number },
  dx: number,
  whileHeld?: () => Promise<void>,
) {
  const touch = await page.context().newCDPSession(page);

  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let step = 1; step <= SWIPE_STEPS; step += 1) {
    const x = start.x + (dx * step) / SWIPE_STEPS;
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: start.y }],
    });
    await page.waitForTimeout(FRAME_MS);
  }
  await whileHeld?.();
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
}

/** Negative `dx` swipes left. */
async function swipeGallery(page: Page, dx: number) {
  const box = await galleryTrack(page).boundingBox();
  if (!box) {
    throw new Error('the gallery is not on screen');
  }
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, dx);

  // At rest on a slide: a click on a moving slide scrolls the track again first.
  await expect
    .poll(() => galleryTrack(page).evaluate((track) => track.scrollLeft % track.clientWidth))
    .toBe(0);
}

/**
 * WebKit's rule, which Chromium does not apply: a video plays with sound only from a play()
 * made while a tap's handler runs, or on an element a tap already played with sound.
 */
const refuseSoundOutsideTaps = (page: Page) =>
  page.addInitScript(() => {
    let isInTap = false;
    const unlocked = new WeakSet<HTMLMediaElement>();
    window.addEventListener('click', () => (isInTap = true), true);
    window.addEventListener('click', () => (isInTap = false));
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.muted && isInTap) {
        unlocked.add(this);
      } else if (!this.muted && !unlocked.has(this)) {
        return Promise.reject(new DOMException('', 'NotAllowedError'));
      }
      return play.call(this);
    };
  });

/** In the feed, a card with the "Video" badge, once the feed has had time to preview one. */
async function videoCard(page: Page) {
  const card = page.getByRole('button', { name: /^Xem chi tiết / }).filter({ hasText: 'Video' });
  const home = page
    .locator('.zaui-page')
    .filter({ has: page.getByRole('heading', { name: 'Danh mục' }) });
  for (let step = 0; step < MAX_FEED_SCROLLS && (await card.count()) === 0; step += 1) {
    await home.evaluate((element, by) => element.scrollBy(0, by), FEED_SCROLL_PX);
    await page.waitForTimeout(FEED_SCROLL_WAIT_MS);
  }
  await card.first().evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await expectFeedPreviewOnly(page);
  return card.first();
}

/** A feed card plays its preview, muted, and no other video plays. */
async function expectFeedPreviewOnly(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('video'))
          .filter((element) => !element.paused && element.currentTime > 0)
          .map((element) => Boolean(element.closest('[role="listitem"]')) && element.muted),
      ),
    )
    .toEqual([true]);
}

/** The page slides in: a drag that starts mid-slide does not reach the gallery. */
async function waitForGalleryAtRest(page: Page) {
  let lastX: number | undefined;
  await expect
    .poll(async () => {
      const x = (await galleryTrack(page).boundingBox())?.x;
      const isResting = x !== undefined && x === lastX;
      lastX = x;
      return isResting;
    })
    .toBe(true);
}

test.beforeEach(({ page }) => skipReelsGestureHint(page));

test('swipes the detail gallery and autoplays its video, muted until a tap allows sound', async ({
  page,
}) => {
  await refuseSoundOutsideTaps(page);
  await page.goto('/');
  const card = await videoCard(page);
  const label = (await card.getAttribute('aria-label')) ?? '';
  await card.click();
  const heading = page.getByRole('heading', { level: 1, name: label.replace('Xem chi tiết ', '') });
  await expect(heading).toBeVisible();
  await expect(counter(page)).toHaveAccessibleName(/^Nội dung 1 trên/);

  await waitForGalleryAtRest(page);

  const videoSlide = await galleryTrack(page)
    .locator(':scope > *')
    .evaluateAll((slides) =>
      slides.findIndex((slide) => slide.querySelector('[aria-label="Xem video toàn màn hình"]')),
    );
  expect(videoSlide).toBeGreaterThan(0);
  const video = galleryVideo(page);
  await expect(video).toHaveCount(0);

  for (let slide = 1; slide <= videoSlide; slide += 1) {
    await swipeGallery(page, -SWIPE_DISTANCE_PX);
    await expect(counter(page)).toHaveAccessibleName(new RegExp(`^Nội dung ${slide + 1} trên`));
  }
  await expectPlaying(video);
  expect(await video.evaluate((element: HTMLVideoElement) => element.controls)).toBe(false);
  // Reached by a swipe, not a tap: the WebView refuses sound, so it plays muted.
  expect(await isMuted(video)).toBe(true);
  await expect(page.getByRole('button', { name: 'Bật âm thanh' })).toBeVisible();

  await page.getByRole('button', { name: 'Bật âm thanh' }).click();
  expect(await isMuted(video)).toBe(false);
  await expectPlaying(video);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tắt âm thanh' }).click();
  expect(await isMuted(video)).toBe(true);
  await page.getByRole('button', { name: 'Bật âm thanh' }).click();
  expect(await isMuted(video)).toBe(false);

  // A right swipe on the page is "back"; on the gallery it is only the previous slide.
  await swipeGallery(page, SWIPE_DISTANCE_PX);
  await expect(counter(page)).toHaveAccessibleName(new RegExp(`^Nội dung ${videoSlide} trên`));
  await expect(heading).toBeVisible();
  await expect(video).toHaveCount(0);

  // The tap unlocked the element, so coming back the video starts with sound.
  await swipeGallery(page, -SWIPE_DISTANCE_PX);
  await expectPlaying(video);
  expect(await isMuted(video)).toBe(false);
  await page.getByRole('button', { name: 'Xem video toàn màn hình' }).click();
  const lightbox = page.getByRole('dialog', { name: /^Ảnh và video: / });
  await expect(lightbox).toContainText(`${videoSlide + 1} / `);
  await expect(video).toHaveCount(0);

  await lightbox.locator('.snap-x').evaluate((track) => {
    track.scrollLeft = 0;
  });
  await expect(lightbox).toContainText('1 / ');
  await lightbox.getByRole('button', { name: 'Đóng' }).click();
  await expect(counter(page)).toHaveAccessibleName(/^Nội dung 1 trên/);
  expect(await galleryTrack(page).evaluate((track) => track.scrollLeft)).toBe(0);
  await expect(video).toHaveCount(0);

  // Back on Home the feed plays its previews again, and nothing else plays.
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect(heading).toHaveCount(0);
  await expectFeedPreviewOnly(page);

  // A later listing starts with sound too.
  await card.click();
  for (let slide = 1; slide <= videoSlide; slide += 1) {
    await waitForGalleryAtRest(page);
    await swipeGallery(page, -SWIPE_DISTANCE_PX);
  }
  await expectPlaying(video);
  expect(await isMuted(video)).toBe(false);
});

test('in Reels, the detail video plays only while the detail pane is on screen', async ({
  page,
}) => {
  await page.goto('/');
  await tab(page, 'Reels').click();
  const reelVideo = page.locator('section[data-reel-index="0"] video');
  await expectPlaying(reelVideo);

  await page
    .locator('section[data-reel-index="0"]')
    .getByRole('button', { name: 'Xem chi tiết' })
    .click();
  await expect
    .poll(() => pager(page).evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(300);
  await expect(counter(page)).toBeVisible();

  const video = galleryVideo(page);
  await swipeGallery(page, -SWIPE_DISTANCE_PX);
  await expect(counter(page)).toHaveAccessibleName(/^Nội dung 2 trên/);
  await expectPlaying(video);
  expect(await isMuted(video)).toBe(false);
  expect(await isPaused(reelVideo)).toBe(true);

  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect.poll(() => pager(page).evaluate((element) => element.scrollLeft)).toBe(0);
  await expect(video).toHaveCount(0);
  await expectPlaying(reelVideo);

  // Partway toward the detail the reel has stopped and the detail video has not started.
  const { width, height } = page.viewportSize() ?? { width: 412, height: 839 };
  await drag(page, { x: width * 0.8, y: height / 2 }, -width * 0.3, async () => {
    await expect.poll(() => isPaused(reelVideo)).toBe(true);
    // Long enough for a wrong play() to have started.
    await page.waitForTimeout(SETTLE_MS);
    await expect(video).toHaveCount(0);
  });

  // Back on the detail, its video picks up again.
  await pager(page).evaluate((element) => element.scrollTo({ left: element.clientWidth }));
  await expectPlaying(video);
  expect(await isPaused(reelVideo)).toBe(true);
});
