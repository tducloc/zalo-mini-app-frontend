import type { Locator, Page } from '@playwright/test';

import { expect, skipReelsGestureHint, tab, test } from './support';

const SWIPE_STEPS = 10;
const FRAME_MS = 16;
const SETTLE_MS = 500;
const SWIPE_DISTANCE_PX = 250;
const MAX_FEED_SCROLLS = 30;
const FEED_SCROLL_PX = 700;
const FEED_SCROLL_WAIT_MS = 100;
const PINCH_FROM_PX = 60;
const PINCH_TO_PX = 240;
const DOUBLE_TAP_GAP_MS = 80;
const DOUBLE_TAP_SCALE = 2.5;
const TRACKPAD_SCROLLS = 10;
// A trackpad's sideways scroll: mostly deltaX, with a little deltaY.
const TRACKPAD_DELTA_X = 40;
const TRACKPAD_DELTA_Y = -3;

const counter = (page: Page) => page.getByLabel(/^Nội dung \d+ trên \d+$/);
const galleryTrack = (page: Page) => page.locator('[data-gallery-track]');
const galleryVideo = (page: Page) => galleryTrack(page).locator('video');
const pager = (page: Page) => page.locator('[data-reels-pager]');

const lightbox = (page: Page) => page.getByRole('dialog', { name: /^Ảnh và video: / });
const lightboxTrack = (page: Page) => lightbox(page).locator('.snap-x');
const coverPhoto = (page: Page) => lightbox(page).locator('.react-transform-component').first();
const photoScale = (page: Page) =>
  coverPhoto(page).evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);

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

async function coverCentre(page: Page) {
  const box = await lightbox(page).locator('.react-transform-wrapper').first().boundingBox();
  if (!box) {
    throw new Error('the cover photo is not on screen');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Two fingers moving apart sideways over the cover photo. */
async function pinchCover(page: Page) {
  const { x, y } = await coverCentre(page);
  const fingers = (gap: number) => [
    { x: x - gap / 2, y, id: 0 },
    { x: x + gap / 2, y, id: 1 },
  ];
  const touch = await page.context().newCDPSession(page);

  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: fingers(PINCH_FROM_PX),
  });
  for (let step = 1; step <= SWIPE_STEPS; step += 1) {
    const gap = PINCH_FROM_PX + ((PINCH_TO_PX - PINCH_FROM_PX) * step) / SWIPE_STEPS;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(gap) });
    await page.waitForTimeout(FRAME_MS);
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
}

async function doubleTapCover(page: Page) {
  const point = await coverCentre(page);
  const touch = await page.context().newCDPSession(page);
  for (let tap = 0; tap < 2; tap += 1) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(DOUBLE_TAP_GAP_MS);
  }
  await touch.detach();
}

/** A swipe flings the track on; a pinch that starts mid-fling scrolls instead of zooming. */
async function waitForLightboxAtRest(page: Page) {
  let lastLeft: number | undefined;
  await expect
    .poll(async () => {
      const left = await lightboxTrack(page).evaluate((track) => track.scrollLeft);
      const isResting = left === lastLeft;
      lastLeft = left;
      return isResting;
    })
    .toBe(true);
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

/** Swipes from the cover to the listing's video slide and returns its index. */
async function swipeToVideo(page: Page) {
  const videoSlide = await galleryTrack(page)
    .locator(':scope > *')
    .evaluateAll((slides) =>
      slides.findIndex((slide) => slide.querySelector('[aria-label="Xem video toàn màn hình"]')),
    );
  expect(videoSlide).toBeGreaterThan(0);

  for (let slide = 1; slide <= videoSlide; slide += 1) {
    await swipeGallery(page, -SWIPE_DISTANCE_PX);
    await expect(counter(page)).toHaveAccessibleName(new RegExp(`^Nội dung ${slide + 1} trên`));
  }
  return videoSlide;
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

  const video = galleryVideo(page);
  await expect(video).toHaveCount(0);

  const videoSlide = await swipeToVideo(page);
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
  await swipeToVideo(page);
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

test('zooms a photo in the viewer, which holds the swipe until it zooms back', async ({ page }) => {
  await page.goto('/');
  await (await videoCard(page)).click();
  await waitForGalleryAtRest(page);
  await page.getByRole('button', { name: 'Phóng to ảnh' }).first().click();
  await expect(lightbox(page)).toContainText('1 / ');
  await waitForLightboxAtRest(page);

  await pinchCover(page);
  await expect.poll(() => photoScale(page)).toBeGreaterThan(DOUBLE_TAP_SCALE);

  const zoomedTransform = await coverPhoto(page).evaluate((element) => element.style.transform);
  await drag(page, await coverCentre(page), -SWIPE_DISTANCE_PX);
  await expect
    .poll(() => coverPhoto(page).evaluate((element) => element.style.transform))
    .not.toBe(zoomedTransform);
  expect(await lightboxTrack(page).evaluate((track) => track.scrollLeft)).toBe(0);
  await expect(lightbox(page)).toContainText('1 / ');

  await doubleTapCover(page);
  await expect.poll(() => photoScale(page)).toBe(1);
  await doubleTapCover(page);
  await expect.poll(() => photoScale(page)).toBe(DOUBLE_TAP_SCALE);
  await doubleTapCover(page);
  await expect.poll(() => photoScale(page)).toBe(1);

  await drag(page, await coverCentre(page), -SWIPE_DISTANCE_PX);
  await expect(lightbox(page)).toContainText('2 / ');
});

test.describe('with a trackpad', () => {
  test.use({ isMobile: false, hasTouch: false });

  test('scrolls the viewer sideways without zooming, and zooms on a pinch', async ({ page }) => {
    await page.goto('/');
    await (await videoCard(page)).click();
    await waitForGalleryAtRest(page);
    await page.getByRole('button', { name: 'Phóng to ảnh' }).first().click();
    await expect(lightbox(page)).toContainText('1 / ');

    const { x, y } = await coverCentre(page);
    await page.mouse.move(x, y);
    for (let scroll = 0; scroll < TRACKPAD_SCROLLS; scroll += 1) {
      await page.mouse.wheel(TRACKPAD_DELTA_X, TRACKPAD_DELTA_Y);
      await page.waitForTimeout(FRAME_MS);
    }
    await expect(lightbox(page)).toContainText('2 / ');
    expect(await photoScale(page)).toBe(1);

    await lightboxTrack(page).evaluate((track) => {
      track.scrollLeft = 0;
    });
    await waitForLightboxAtRest(page);
    // The browser sends a trackpad pinch as a wheel with ctrlKey.
    await page.keyboard.down('Control');
    for (let scroll = 0; scroll < TRACKPAD_SCROLLS; scroll += 1) {
      await page.mouse.wheel(0, -TRACKPAD_DELTA_X);
      await page.waitForTimeout(FRAME_MS);
    }
    await page.keyboard.up('Control');
    await expect.poll(() => photoScale(page)).toBeGreaterThan(1);
  });
});
