import { API_URL, dragPhoto, expect, fixture, openSellPage, sellForm, tab, test } from './support';

/**
 * L6 acceptance (plans/create-listing.md, "L6 in phases"): a seller picks photos and a
 * video, fills the form while they upload, and posts. Written before the form (L6.2).
 */

const TITLE = `E2E iPhone 13 ${Date.now()}`;
/** Checking, optimizing and uploading a fixture on the local stack. */
const UPLOAD_TIMEOUT_MS = 60_000;

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

  // Held and dragged first, the second photo becomes the cover. Tile names follow the
  // position, so the picture tells which photo moved.
  const secondPicture = tiles.nth(1).locator('img');
  await expect(secondPicture).toHaveAttribute('src', /.+/, { timeout: UPLOAD_TIMEOUT_MS });
  const secondSource = (await secondPicture.getAttribute('src')) ?? '';
  await dragPhoto(page, 1, 0);
  await expect(tiles.first().locator('img')).toHaveAttribute('src', secondSource);
  await expect(tiles.first()).toContainText('Ảnh bìa');

  // Fields, filled while the files upload.
  await sellForm(page).getByLabel('Danh mục').selectOption({ label: 'Điện tử' });
  await sellForm(page).getByLabel('Tiêu đề').fill(TITLE);
  await sellForm(page).getByLabel('Mô tả').fill('Máy dùng tốt, pin 90%, đủ hộp và cáp.');
  await sellForm(page).getByLabel('Giá bán (VNĐ)').fill('6990000');
  await sellForm(page).getByLabel('Như mới').check();
  await sellForm(page).getByLabel('Địa điểm').selectOption({ label: 'Hà Nội' });

  // Post waits for every file to be uploaded.
  const post = page.getByRole('main').getByRole('button', { name: 'Đăng tin', exact: true });
  await expect(post).toBeEnabled({ timeout: UPLOAD_TIMEOUT_MS });

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
  await sellForm(page).getByLabel('Tiêu đề').fill(TITLE);

  await tab(page, 'Trang chủ').click();
  await tab(page, 'Đăng tin').click();

  await expect(sellForm(page).getByLabel('Tiêu đề')).toHaveValue(TITLE);
  await expect(page.getByRole('listitem', { name: 'Ảnh 1' })).toBeVisible();
});

test('shows the draft on other pages, and Huỷ tin ends it', async ({ page }) => {
  await openSellPage(page);
  await page.getByLabel('Thêm ảnh', { exact: true }).setInputFiles(fixture('photo-a.jpg'));
  await sellForm(page).getByLabel('Tiêu đề').fill(TITLE);

  // Away from the sell page, the tab says so in its description: its name stays.
  await tab(page, 'Trang chủ').click();
  const sellTab = tab(page, 'Đăng tin');
  await expect(sellTab).toHaveAccessibleName('Đăng tin');
  await expect(sellTab).toHaveAccessibleDescription('Bạn có tin đăng chưa hoàn tất');

  // A banner above the tab bar on every page but the sell page leads back to the draft.
  const banner = page.getByRole('complementary', { name: 'Tin đang đăng dở' });
  await expect(banner).toContainText('Bạn có tin đăng chưa hoàn tất');
  await tab(page, 'Cá nhân').click();
  await banner.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(sellForm(page).getByLabel('Tiêu đề')).toHaveValue(TITLE);
  await expect(banner).toHaveCount(0);
  await tab(page, 'Trang chủ').click();

  // The product page has no tab bar: the banner is in its bottom bar.
  await page
    .getByRole('button', { name: /^Xem chi tiết/ })
    .first()
    .click();
  await expect(page.locator('.product-detail-actions').getByRole('complementary')).toBeVisible();
  await banner.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(sellForm(page).getByLabel('Tiêu đề')).toHaveValue(TITLE);

  // ---- Huỷ tin ----

  // It asks first; "Tiếp tục đăng" keeps the draft. zmp-ui renders the dialog, with its own
  // "Huỷ tin", in place: after the form's button.
  const discard = sellForm(page).getByRole('button', { name: 'Huỷ tin' }).first();
  await discard.click();
  // zmp-ui's Modal gives its dialog no name.
  const dialog = page.getByRole('dialog').filter({ hasText: 'Huỷ tin đang đăng?' });
  await dialog.getByRole('button', { name: 'Tiếp tục đăng' }).click();
  await expect(sellForm(page).getByLabel('Tiêu đề')).toHaveValue(TITLE);

  // The uploaded photo is deleted on the server too.
  await expect(page.getByRole('button', { name: /Ảnh 1, đã sẵn sàng/ })).toBeVisible({
    timeout: UPLOAD_TIMEOUT_MS,
  });
  const deleted = page.waitForRequest((request) => request.method() === 'DELETE');
  await discard.click();
  await dialog.getByRole('button', { name: 'Huỷ tin' }).click();
  expect((await deleted).url()).toMatch(/\/media\/[\w-]+$/);
  await expect(page.getByText('Đã huỷ tin.')).toBeVisible();
  await expect(sellForm(page).getByLabel('Tiêu đề')).toHaveValue('');
  await expect(page.getByRole('listitem', { name: 'Ảnh 1' })).toHaveCount(0);
  await expect(sellForm(page).getByRole('button', { name: 'Huỷ tin' })).toHaveCount(0);
  // The dialog locks the page's scrolling while open; it must not stay locked.
  await expect(page.locator('.zaui-page.disable-scrolling')).toHaveCount(0);

  await tab(page, 'Trang chủ').click();
  await expect(sellTab).toHaveAccessibleDescription('');
});
