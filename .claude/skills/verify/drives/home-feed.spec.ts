import type { Page, Request } from '@playwright/test';

import { tab } from '../../../../e2e/support';
import { expect, settled, test } from './support';

const DETAIL_PREFIX = 'Xem chi tiết ';

/** The home page's content; other pages can stay in the DOM behind it. */
const feed = (page: Page) =>
  page.getByRole('main').filter({ has: page.getByRole('heading', { name: 'Danh mục' }) });
const cards = (page: Page) =>
  feed(page).getByRole('button', { name: new RegExp(`^${DETAIL_PREFIX}`) });
const listHeading = (page: Page, name: 'Tin đăng mới' | 'Kết quả') =>
  feed(page).getByRole('heading', { name, level: 2 });
const feedRequest = (page: Page, param: string, value: string) =>
  page.waitForRequest((request: Request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith('/products') && url.searchParams.get(param) === value;
  });

async function cardTitle(page: Page, index: number) {
  const label = await cards(page).nth(index).getAttribute('aria-label');
  return (label ?? '').slice(DETAIL_PREFIX.length);
}

test('home feed: categories, search, "Có video" filter, autoplay, state kept across detail', async ({
  page,
  proof,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chợ Zalo', level: 1 })).toBeVisible();
  await expect(tab(page, 'Trang chủ')).toHaveAttribute('aria-current', 'page');
  const categories = page.getByRole('group', { name: 'Lọc theo danh mục' });
  await expect(categories.getByRole('button')).toHaveText([
    'Điện tử',
    'Nhà cửa',
    'Thời trang',
    'Xe cộ',
    'Khác',
  ]);
  await expect(listHeading(page, 'Tin đăng mới')).toBeVisible();
  await expect(cards(page).first()).toBeVisible();
  await proof('feed');

  const electronics = categories.getByRole('button', { name: 'Điện tử' });
  const byCategory = feedRequest(page, 'categoryId', 'cat_electronics');
  await electronics.click();
  await byCategory;
  await expect(electronics).toHaveAttribute('aria-pressed', 'true');
  await expect(listHeading(page, 'Kết quả')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bỏ lọc Điện tử' })).toBeVisible();
  await proof('category-selected');
  await electronics.click();
  await expect(electronics).toHaveAttribute('aria-pressed', 'false');
  await expect(listHeading(page, 'Tin đăng mới')).toBeVisible();

  const title = await cardTitle(page, 0);
  const term = title
    .split(/\s+/)
    .reduce((longest, word) => (word.length > longest.length ? word : longest));
  const search = page.getByRole('searchbox', { name: 'Tìm kiếm tin đăng' });
  const searched = feedRequest(page, 'q', term);
  await search.fill(term);
  await searched;
  await expect(listHeading(page, 'Kết quả')).toBeVisible();
  // Seeded titles repeat, so any card with the title will do.
  await expect(
    page.getByRole('button', { name: `${DETAIL_PREFIX}${title}` }).first(),
  ).toBeVisible();
  await proof('search-match');

  await search.fill('khongcotinnaokhop');
  await expect(page.getByText('Không tìm thấy tin phù hợp')).toBeVisible();
  await proof('search-empty');
  await page.getByRole('button', { name: 'Xoá tìm kiếm và bộ lọc' }).click();
  await expect(search).toHaveValue('');
  await expect(listHeading(page, 'Tin đăng mới')).toBeVisible();

  await page.getByRole('button', { name: 'Mở bộ lọc', exact: true }).click();
  const hasVideo = page.getByRole('button', { name: 'Có video' });
  await hasVideo.click();
  await expect(hasVideo).toHaveAttribute('aria-pressed', 'true');
  await proof('filter-sheet');
  const videoOnly = feedRequest(page, 'hasVideo', 'true');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await videoOnly;
  await expect(
    page.getByRole('button', { name: 'Mở bộ lọc, đang áp dụng 1 bộ lọc' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bỏ lọc Có video' })).toBeVisible();
  await expect(cards(page).first()).toBeVisible();
  for (const card of await cards(page).all()) {
    await expect(card, 'every card under "Có video" has the Video badge').toContainText('Video');
  }

  await expect
    .poll(
      () =>
        feed(page).evaluate((main) =>
          [...main.querySelectorAll('video')].some(
            (video) => !video.paused && video.currentTime > 0,
          ),
        ),
      { message: 'a card preview autoplays', timeout: 30_000 },
    )
    .toBe(true);
  await proof('autoplay');

  const opened = await cardTitle(page, 0);
  await cards(page).first().click();
  const detailHeading = page.getByRole('heading', { name: opened, level: 1 });
  await expect(detailHeading).toBeVisible();
  await settled(detailHeading);
  await proof('detail');
  await page.getByRole('button', { name: 'Quay lại' }).last().click();
  await expect(tab(page, 'Trang chủ')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Bỏ lọc Có video' })).toBeVisible();
  await settled(listHeading(page, 'Kết quả'));
  await proof('back-with-filter-kept');

  await page.getByRole('button', { name: 'Bỏ lọc Có video' }).click();
  await expect(listHeading(page, 'Tin đăng mới')).toBeVisible();
  await proof('filter-removed');
});
