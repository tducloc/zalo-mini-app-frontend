import type { Locator, Page } from '@playwright/test';

import { expect, tab, test } from './support';

/** zmp-ui keeps the home page in the DOM behind a page sliding in. */
const homePage = (page: Page) =>
  page.locator('.zaui-page').filter({ has: page.getByRole('heading', { name: 'Danh mục' }) });
const feedList = (page: Page) => page.getByRole('list', { name: 'Tin đăng' });
const feedCards = (page: Page) => feedList(page).getByRole('listitem');
const cardAt = (page: Page, position: number) =>
  feedList(page).locator(`[aria-posinset="${position}"]`);

const PAGE_SIZE = 20;
const MAX_MOUNTED_CARDS = 40;

const scrollBy = (page: Page, pixels: number) =>
  homePage(page).evaluate((element, by) => element.scrollBy(0, by), pixels);
const scrollTopOf = (page: Page) => homePage(page).evaluate((element) => element.scrollTop);

async function firstRowTops(page: Page) {
  return feedCards(page).evaluateAll((items) => {
    const tops = items.map((item) => Math.round(item.getBoundingClientRect().top));
    return tops.filter((top) => top === Math.min(...tops));
  });
}

async function rowGeometry(page: Page) {
  return feedCards(page).evaluateAll((items) => {
    const rects = items.map((item) => item.getBoundingClientRect());
    const tops = [...new Set(rects.map((rect) => Math.round(rect.top)))].sort((a, b) => a - b);
    return { pitch: tops[1] - tops[0], cardHeight: rects[0].height };
  });
}

async function expectPlayingInView(list: Locator) {
  await expect
    .poll(
      () =>
        list.evaluate((element) => {
          const playing = Array.from(element.querySelectorAll('video')).find(
            (video) => !video.paused && video.currentTime > 0,
          );
          const card = playing?.closest('[role="listitem"]');
          if (!card) {
            return null;
          }
          const scroller = element.closest('.zaui-page')!.getBoundingClientRect();
          const rect = card.getBoundingClientRect();
          return rect.bottom > scroller.top && rect.top < scroller.bottom
            ? card.getAttribute('aria-posinset')
            : 'off screen';
        }),
      { message: 'a preview plays in a card on screen', timeout: 30_000 },
    )
    .toMatch(/^\d+$/);
}

test('keeps only the rows near the screen while ten pages load', async ({ page }) => {
  const nextPages: string[] = [];
  page.on('request', (request) => {
    if (/\/products\?.*cursor=/.test(request.url())) {
      nextPages.push(request.url());
    }
  });
  await page.goto('/');
  await expect(cardAt(page, 1)).toBeVisible();

  expect(await firstRowTops(page)).toHaveLength(2);
  const { pitch, cardHeight } = await rowGeometry(page);
  expect(Math.abs(pitch - (cardHeight + 10))).toBeLessThan(1);

  const lastCard = cardAt(page, 10 * PAGE_SIZE);
  let mostMounted = 0;
  for (let step = 0; step < 600 && (await lastCard.count()) === 0; step += 1) {
    await scrollBy(page, 700);
    await page.waitForTimeout(40);
    mostMounted = Math.max(mostMounted, await feedCards(page).count());
  }

  await expect(lastCard).toBeAttached();
  expect(nextPages.length).toBeGreaterThanOrEqual(9);
  expect(mostMounted).toBeLessThanOrEqual(MAX_MOUNTED_CARDS);
  await expect(cardAt(page, 1)).toHaveCount(0);
  await expect(feedList(page).locator('[aria-setsize="-1"]').first()).toBeAttached();
});

test('comes back from a listing to the same place, with no empty frame', async ({ page }) => {
  await page.goto('/');
  await expect(cardAt(page, 1)).toBeVisible();

  const target = cardAt(page, 3 * PAGE_SIZE);
  for (let step = 0; step < 100 && (await target.count()) === 0; step += 1) {
    await scrollBy(page, 700);
    await page.waitForTimeout(40);
  }
  await target.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  // zmp-ui's Page saves its scroll position 150 ms after scrolling stops.
  await page.waitForTimeout(400);
  const savedTop = await scrollTopOf(page);
  const card = target.getByRole('button');
  const label = (await card.getAttribute('aria-label')) ?? '';
  await expect(cardAt(page, 1)).toHaveCount(0);

  await card.click();
  await expect(
    page.getByRole('heading', { level: 1, name: label.replace('Xem chi tiết ', '') }),
  ).toBeVisible();

  await page.evaluate(() => {
    const frames: { top: number; cards: number }[] = [];
    (window as unknown as { feedFrames: typeof frames }).feedFrames = frames;
    const tick = () => {
      const list = document.querySelector('[role="list"][aria-label="Tin đăng"]');
      const scroller = list?.closest('.zaui-page');
      if (list && scroller) {
        const view = scroller.getBoundingClientRect();
        const cards = Array.from(list.querySelectorAll('[role="listitem"]')).filter((item) => {
          const rect = item.getBoundingClientRect();
          return rect.bottom > view.top && rect.top < view.bottom;
        });
        frames.push({ top: scroller.scrollTop, cards: cards.length });
      }
      if (frames.length < 60) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
  await page.getByRole('button', { name: 'Quay lại' }).last().click();
  await expect(tab(page, 'Trang chủ')).toHaveAttribute('aria-current', 'page');

  await expect.poll(() => scrollTopOf(page)).toBeCloseTo(savedTop, 0);
  await expect(target).toBeInViewport();
  const frames = await page.evaluate(
    () => (window as unknown as { feedFrames: { top: number; cards: number }[] }).feedFrames,
  );
  const restoredFrames = frames.filter((frame) => frame.top > 0);
  expect(restoredFrames.length).toBeGreaterThan(0);
  expect(restoredFrames.filter((frame) => frame.cards === 0)).toEqual([]);
});

test('plays a preview from the second row as the app opens, before any scroll', async ({
  page,
}) => {
  // A tall phone, where the second row is on screen enough to play. As on production, the first
  // page's preview cards sit in that row, which mounts after the first.
  await page.setViewportSize({ width: 390, height: 932 });
  await page.route(
    (url) => url.pathname.endsWith('/api/v1/products') && !url.searchParams.has('cursor'),
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const previews = body.data.filter((card: { previewUrl?: string }) => card.previewUrl);
      const others = body.data.filter((card: { previewUrl?: string }) => !card.previewUrl);
      body.data = [...others.slice(0, 2), ...previews, ...others.slice(2)];
      await route.fulfill({ response, json: body });
    },
  );
  await page.goto('/');

  await expectPlayingInView(feedList(page));
  expect(await scrollTopOf(page)).toBe(0);
});

test('plays a preview on screen and hands the video on when its card unmounts', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở bộ lọc', exact: true }).click();
  await page.getByRole('button', { name: 'Có video' }).click();
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(page.getByRole('button', { name: 'Bỏ lọc Có video' })).toBeVisible();

  const list = feedList(page);
  await expectPlayingInView(list);
  const first = await list.evaluate(
    (element) =>
      element.querySelector('video')?.closest('[role="listitem"]')?.getAttribute('aria-posinset') ??
      '',
  );

  for (let step = 0; step < 8; step += 1) {
    await scrollBy(page, 700);
    await page.waitForTimeout(40);
  }
  await expect(cardAt(page, Number(first))).toHaveCount(0);
  await expectPlayingInView(list);
  await expect(page.locator('video[src]')).toHaveCount(1);
});

for (const { width, height, columns } of [
  { width: 820, height: 1180, columns: 3 },
  { width: 1180, height: 820, columns: 4 },
]) {
  test.describe(`iPad ${width}×${height}`, () => {
    test.use({ viewport: { width, height } });

    test(`shows ${columns} cards a row`, async ({ page }) => {
      await page.goto('/');
      await expect(cardAt(page, 1)).toBeVisible();

      expect(await firstRowTops(page)).toHaveLength(columns);
      const { pitch, cardHeight } = await rowGeometry(page);
      expect(Math.abs(pitch - (cardHeight + 10))).toBeLessThan(1);
    });
  });
}
