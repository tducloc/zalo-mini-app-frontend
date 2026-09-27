import { readFileSync } from 'node:fs';

import type { APIRequestContext, Page } from '@playwright/test';

import {
  API_URL,
  addPhotos,
  expect,
  expectReadyToPost,
  fillFields,
  fixture,
  openSellPage,
  postButton,
  tab,
  test,
} from './support';

/**
 * L7 "Sửa tin" (plans/create-listing.md, L7): the owner edits a listing in the sell form,
 * from My listings, against the local stack. `blank.jpg` is a flat-colour photo the media
 * worker fails with BLANK_IMAGE, which makes a FAILED listing to repair.
 */

const title = (what: string) => `E2E sửa ${what} ${Date.now()}`;
/** Checking, optimizing, uploading and processing a fixture on the local stack. */
const MEDIA_TIMEOUT_MS = 60_000;
const CREATED_STATUS = 201;
/** Posted with media still processing. */
const ACCEPTED_STATUS = 202;

/** The API's Bearer token, taken from the app's own requests once it has signed in. */
function watchToken(page: Page) {
  let token: string | undefined;
  page.on('request', (request) => {
    token = request.headers().authorization ?? token;
  });
  return () => {
    if (!token) {
      throw new Error('the app has not called the API signed in yet');
    }
    return token;
  };
}

async function listingStatus(request: APIRequestContext, token: string, productId: string) {
  const response = await request.get(`${API_URL}/products/${productId}`, {
    headers: { authorization: token },
  });
  const { data } = await response.json();
  return data.status as string;
}

/** Posts the form and answers with the new listing's id; the app then opens My listings. */
async function post(page: Page) {
  await expectReadyToPost(page);
  const created = page.waitForResponse(
    (response) => response.url().endsWith('/products') && response.request().method() === 'POST',
  );
  await postButton(page).click();
  const response = await created;
  expect([201, 202]).toContain(response.status());
  const { data } = await response.json();
  await expect(tab(page, 'Quản lý tin')).toHaveAttribute('aria-current', 'page');
  return data.id as string;
}

/** From My listings: the card's "•••", then "Sửa tin". */
async function openEdit(page: Page, listingTitle: string) {
  await page.getByRole('button', { name: `Tuỳ chọn cho ${listingTitle}` }).click();
  // zmp-ui's sheet has no role or name; a failed card has its own "Sửa tin" too.
  await page.locator('.zaui-sheet').getByRole('button', { name: 'Sửa tin' }).click();
  await expect(page.getByRole('form', { name: 'Sửa tin đăng' })).toBeVisible();
}

/**
 * Posts a listing with only the blank photo through the API, each step right after the
 * other. The media worker fails the photo within about a second of `complete`, and a
 * listing cannot take a failed photo (409): through the form, the worker sometimes won.
 */
async function postBlankListing(request: APIRequestContext, token: string, listingTitle: string) {
  const headers = { authorization: token };
  const bytes = readFileSync(fixture('blank.jpg'));

  const registered = await request.post(`${API_URL}/media/upload-urls`, {
    headers,
    data: {
      files: [
        {
          clientFileId: 'blank',
          type: 'IMAGE',
          contentType: 'image/jpeg',
          size: bytes.length,
          originalBytes: bytes.length,
          optimized: false,
        },
      ],
    },
  });
  expect(registered.status(), await registered.text()).toBe(CREATED_STATUS);
  const [upload] = (await registered.json()).data.uploads;

  const stored = await request.put(upload.presignedUrl, {
    headers: { 'content-type': 'image/jpeg' },
    data: bytes,
  });
  expect(stored.ok()).toBe(true);
  await request.post(`${API_URL}/media/${upload.mediaId}/complete`, { headers });

  const created = await request.post(`${API_URL}/products`, {
    headers: { ...headers, 'idempotency-key': `e2e-blank-${Date.now()}` },
    data: {
      title: listingTitle,
      description: 'Máy dùng tốt, pin 90%, đủ hộp và cáp.',
      price: 6_990_000,
      categoryId: 'cat_electronics',
      condition: 'LIKE_NEW',
      locationId: 'loc_hanoi',
      mediaIds: [upload.mediaId],
    },
  });
  expect(created.status(), await created.text()).toBe(ACCEPTED_STATUS);
  return (await created.json()).data.id as string;
}

const editForm = (page: Page) => page.getByRole('form', { name: 'Sửa tin đăng' });
const saveButton = (page: Page) => editForm(page).getByRole('button', { name: 'Lưu', exact: true });

function waitForSave(page: Page, productId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.url().endsWith(`/products/${productId}`),
  );
}

test('edits the title and price and replaces a photo', async ({ page }) => {
  const oldTitle = title('trước');
  const newTitle = title('sau');

  await openSellPage(page);
  await addPhotos(page, ['photo-a.jpg', 'photo-b.jpg']);
  await fillFields(page, oldTitle);
  const productId = await post(page);

  await openEdit(page, oldTitle);
  const form = editForm(page);
  await expect(form.getByLabel('Tiêu đề')).toHaveValue(oldTitle);
  await expect(form.getByLabel('Giá bán (VNĐ)')).toHaveValue('6.990.000');
  const tiles = page.getByRole('listitem', { name: /^Ảnh \d+$/ });
  await expect(tiles).toHaveCount(2);

  await form.getByLabel('Tiêu đề').fill(newTitle);
  await form.getByLabel('Giá bán (VNĐ)').fill('6.500.000');
  // Replace the second photo with a new file.
  await page.getByRole('button', { name: 'Xoá Ảnh 2' }).click();
  await addPhotos(page, ['photo-b.jpg']);
  await expect(tiles).toHaveCount(2);
  await expect(saveButton(page)).toBeEnabled({ timeout: MEDIA_TIMEOUT_MS });

  const saved = waitForSave(page, productId);
  await saveButton(page).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  const body = response.request().postDataJSON();
  expect(body).toMatchObject({ title: newTitle, price: 6_500_000 });
  // Only what changed, and the whole media set: the kept cover first, then the new photo.
  expect(Object.keys(body).sort()).toEqual(['mediaIds', 'price', 'title']);
  expect(body.mediaIds).toHaveLength(2);
  const { data } = await response.json();
  expect(data.media.map((item: { id: string }) => item.id)).toEqual(body.mediaIds);

  await expect(page.getByText(/^Đã lưu/)).toBeVisible();
  await expect(tab(page, 'Quản lý tin')).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: `Xem chi tiết ${newTitle}` }).click();
  await expect(page.getByRole('heading', { name: newTitle, level: 1 })).toBeVisible();
  await expect(page.getByText('6.500.000 đ').first()).toBeVisible();
});

test('asks before leaving with unsaved changes, and keeps the sell draft', async ({ page }) => {
  const listingTitle = title('bỏ');

  await openSellPage(page);
  await addPhotos(page, ['photo-a.jpg']);
  await fillFields(page, listingTitle);
  await post(page);

  // A new draft on the sell page, in progress while the seller edits another listing.
  await tab(page, 'Đăng tin').click();
  await page.getByRole('form', { name: 'Tin đăng mới' }).getByLabel('Tiêu đề').fill('Nháp khác');
  await tab(page, 'Quản lý tin').click();

  await openEdit(page, listingTitle);
  await editForm(page).getByLabel('Tiêu đề').fill(`${listingTitle} đổi`);
  await page.getByRole('button', { name: 'Quay lại' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Bỏ các thay đổi?' });
  await dialog.getByRole('button', { name: 'Tiếp tục sửa' }).click();
  await expect(editForm(page).getByLabel('Tiêu đề')).toHaveValue(`${listingTitle} đổi`);

  await page.getByRole('button', { name: 'Quay lại' }).click();
  await dialog.getByRole('button', { name: 'Bỏ thay đổi' }).click();
  await expect(tab(page, 'Quản lý tin')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: `Xem chi tiết ${listingTitle}` })).toBeVisible();

  await tab(page, 'Đăng tin').click();
  await expect(page.getByRole('form', { name: 'Tin đăng mới' }).getByLabel('Tiêu đề')).toHaveValue(
    'Nháp khác',
  );
});

test('repairs a failed listing by replacing the blank photo', async ({ page, request }) => {
  const listingTitle = title('lỗi');
  const token = watchToken(page);

  // Signed in: My listings asks for the seller's own listings.
  await page.goto('/');
  await tab(page, 'Quản lý tin').click();
  await expect(page.getByRole('tablist', { name: 'Trạng thái tin' })).toBeVisible();
  const productId = await postBlankListing(request, token(), listingTitle);

  await expect
    .poll(() => listingStatus(request, token(), productId), { timeout: MEDIA_TIMEOUT_MS })
    .toBe('FAILED');

  // A failed listing has a tab of its own.
  await page.getByRole('tab', { name: /^Bị lỗi/ }).click();
  await openEdit(page, listingTitle);
  // The failed photo is marked, with the reason in its viewer.
  await page.getByRole('button', { name: 'Ảnh 1, có lỗi. Chạm để xem' }).click();
  const viewer = page.getByRole('dialog', { name: 'Ảnh 1' });
  await expect(viewer.getByRole('alert')).toContainText('Vui lòng chọn ảnh khác: ảnh bị trống.');
  await viewer.getByRole('button', { name: /Xoá$/ }).click();

  await addPhotos(page, ['photo-a.jpg']);
  await expect(saveButton(page)).toBeEnabled({ timeout: MEDIA_TIMEOUT_MS });
  const saved = waitForSave(page, productId);
  await saveButton(page).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(Object.keys(response.request().postDataJSON())).toEqual(['mediaIds']);

  await expect(page.getByText(/^Đã lưu/)).toBeVisible();
  await expect
    .poll(() => listingStatus(request, token(), productId), { timeout: MEDIA_TIMEOUT_MS })
    .toBe('PUBLISHED');
});
