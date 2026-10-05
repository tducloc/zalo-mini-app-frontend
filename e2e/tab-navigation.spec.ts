import type { Page } from '@playwright/test';

import { expect, tab, test } from './support';

const SAMPLED_FRAMES = 20;

/** Taps a tab and counts the frames in which a page is still off its place. */
const framesWithSlide = (page: Page, name: string) =>
  tab(page, name).evaluate(async (button: HTMLButtonElement, frames) => {
    button.click();
    let count = 0;
    for (let frame = 0; frame < frames; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const pages = Array.from(document.querySelectorAll('.zaui-routes-item'));
      if (pages.some((element) => element.getBoundingClientRect().left !== 0)) {
        count += 1;
      }
    }
    return count;
  }, SAMPLED_FRAMES);

test('switches tabs in place, without the page slide', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Danh mục' })).toBeVisible();

  expect(await framesWithSlide(page, 'Cá nhân')).toBe(0);
  await expect(tab(page, 'Cá nhân')).toHaveAttribute('aria-current', 'page');

  expect(await framesWithSlide(page, 'Trang chủ')).toBe(0);
  await expect(tab(page, 'Trang chủ')).toHaveAttribute('aria-current', 'page');
});

// The iOS edge swipe goes back in the WebView's history, so a page behind is a page to swipe to.
test('leaves no page to go back to behind a tab, only behind a page with a back button', async ({
  page,
}) => {
  await page.goto('/');
  const historyLength = () => page.evaluate(() => history.length);
  const start = await historyLength();

  for (const name of ['Quản lý tin', 'Reels', 'Cá nhân', 'Trang chủ']) {
    await tab(page, name).click();
    await expect(tab(page, name)).toHaveAttribute('aria-current', 'page');
  }
  expect(await historyLength()).toBe(start);

  await page
    .getByRole('button', { name: /^Xem chi tiết / })
    .first()
    .click();
  await expect(page.getByRole('img', { name: 'Quay lại' })).toBeVisible();
  expect(await historyLength()).toBe(start + 1);

  await page.getByRole('img', { name: 'Quay lại' }).click();
  await expect(tab(page, 'Trang chủ')).toHaveAttribute('aria-current', 'page');
});

test('goes home from the sell tab’s back button, with no page behind it', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Quản lý tin').click();
  await tab(page, 'Đăng tin').click();
  await expect(page.getByRole('heading', { name: 'Hình ảnh sản phẩm' })).toBeVisible();

  await page.getByRole('img', { name: 'Quay lại' }).click();

  await expect(tab(page, 'Trang chủ')).toHaveAttribute('aria-current', 'page');
});
