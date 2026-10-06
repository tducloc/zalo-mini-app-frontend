import { devices } from '@playwright/test';

import { addPhotos, expect, fixture, openSellPage, photoTiles, test } from './support';

/**
 * iOS 15 (iPhone 6s/7, stuck there) has neither OffscreenCanvas nor WebCodecs, and its
 * WebView in Zalo plays a <video> only if the element was already in the page when the
 * viewer last touched it (measured on an iPhone, see src/lib/video-pool.ts). Playwright's
 * WebKit is newer, so the page loses the missing APIs and gets that play() rule here.
 */
function emulateIos15() {
  const missing = [
    'OffscreenCanvas',
    'VideoDecoder',
    'VideoEncoder',
    'VideoFrame',
    'EncodedVideoChunk',
    'AudioDecoder',
    'AudioEncoder',
    'AudioData',
    'EncodedAudioChunk',
  ];
  for (const name of missing) {
    Reflect.deleteProperty(window, name);
  }

  let lastTouchAt = Number.NEGATIVE_INFINITY;
  addEventListener('pointerdown', () => (lastTouchAt = performance.now()), true);

  const createdAt = new WeakMap<object, number>();
  const createElement = Document.prototype.createElement;
  Document.prototype.createElement = function (this: Document, ...args: [string]) {
    const element = createElement.apply(this, args);
    createdAt.set(element, performance.now());
    return element;
  } as typeof createElement;

  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    if ((createdAt.get(this) ?? 0) > lastTouchAt) {
      return Promise.reject(new DOMException('Created after the last touch', 'NotAllowedError'));
    }
    return play.call(this);
  };
}

const { defaultBrowserType: _, ...iPhone } = devices['iPhone 13'];
test.use({ ...iPhone, browserName: 'webkit' });

test('every tile shows a picture on iOS 15', async ({ page }) => {
  await page.addInitScript(emulateIos15);
  await openSellPage(page);
  expect(await page.evaluate(() => 'OffscreenCanvas' in window || 'VideoDecoder' in window)).toBe(
    false,
  );

  await addPhotos(page, ['photo-a.jpg', 'photo-b.jpg']);
  await page.getByLabel('Thêm video', { exact: true }).setInputFiles(fixture('clip.mp4'));

  for (const tile of await photoTiles(page).all()) {
    await expect
      .poll(() => tile.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  }

  // iOS draws no frame for a <video> the page has not played.
  const video = page.getByRole('listitem', { name: 'Video' }).locator('video');
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => ({
        hasPlayed: element.played.length > 0 && element.currentTime > 0,
        isPaused: element.paused,
      })),
    )
    .toEqual({ hasPlayed: true, isPaused: true });
});
