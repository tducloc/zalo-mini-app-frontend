import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

/**
 * L6 acceptance (plans/create-listing.md, "L6 in phases"): a seller picks photos and a
 * video, fills the form while they upload, and posts. Written before the form (L6.2), so
 * it fails until L6.4–L6.6 are done.
 */

// Playwright loads specs as CommonJS here (no "type": "module" in package.json).
const fixture = (name: string) => join(__dirname, 'fixtures', name);

const TITLE = `E2E iPhone 13 ${Date.now()}`;

/** The tab bar's button; the form has its own "Đăng tin" to post. */
const tab = (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('button', { name });

async function openSellPage(page: Page) {
  await page.goto('/');
  await tab(page, 'Đăng tin').click();
  await expect(page.getByRole('heading', { name: 'Hình ảnh sản phẩm' })).toBeVisible();
}

test('posts a listing with two photos and a video', async ({ page }) => {
  await openSellPage(page);

  // Media: one grid of photos, the first is the cover; a separate video slot.
  await page
    .getByLabel('Thêm ảnh', { exact: true })
    .setInputFiles([fixture('photo-a.jpg'), fixture('photo-b.jpg')]);
  await page.getByLabel('Thêm video', { exact: true }).setInputFiles(fixture('clip.mp4'));

  const tiles = page.getByRole('listitem', { name: /^Ảnh \d+$|^Video$/ });
  await expect(tiles).toHaveCount(3);
  await expect(tiles.first()).toContainText('Ảnh bìa');

  // The second photo becomes the cover, from the full-screen viewer.
  await tiles
    .nth(1)
    .getByRole('button', { name: /^Ảnh 2/ })
    .click();
  await page
    .getByRole('dialog', { name: 'Ảnh 2' })
    .getByRole('button', { name: 'Đặt làm ảnh bìa' })
    .click();
  await expect(tiles.first()).toContainText('Ảnh bìa');

  // Fields, filled while the files upload.
  await page.getByLabel('Danh mục').selectOption({ label: 'Điện tử' });
  await page.getByLabel('Tiêu đề').fill(TITLE);
  await page.getByLabel('Mô tả').fill('Máy dùng tốt, pin 90%, đủ hộp và cáp.');
  await page.getByLabel('Giá bán (VNĐ)').fill('6990000');
  await page.getByLabel('Như mới').check();
  await page.getByLabel('Địa điểm').selectOption({ label: 'Hà Nội' });

  // Post waits for every file to be uploaded.
  const post = page.getByRole('main').getByRole('button', { name: 'Đăng tin', exact: true });
  await expect(post).toBeEnabled({ timeout: 60_000 });

  const created = page.waitForResponse(
    (response) => response.url().endsWith('/products') && response.request().method() === 'POST',
  );
  await post.click();
  const response = await created;

  expect([201, 202]).toContain(response.status());
  const { data } = await response.json();
  expect(data).toMatchObject({ title: TITLE, price: 6990000, condition: 'LIKE_NEW' });
  expect(data.media).toHaveLength(3);
  expect(data.media[0]).toMatchObject({ role: 'MAIN', type: 'IMAGE' });

  await expect(tab(page, 'Quản lý tin')).toHaveAttribute('aria-current', 'page');
});

test('keeps the draft when the seller leaves the page and comes back', async ({ page }) => {
  await openSellPage(page);
  await page.getByLabel('Thêm ảnh', { exact: true }).setInputFiles(fixture('photo-a.jpg'));
  await page.getByLabel('Tiêu đề').fill(TITLE);

  await tab(page, 'Trang chủ').click();
  await tab(page, 'Đăng tin').click();

  await expect(page.getByLabel('Tiêu đề')).toHaveValue(TITLE);
  await expect(page.getByRole('listitem', { name: 'Ảnh 1' })).toBeVisible();
});
