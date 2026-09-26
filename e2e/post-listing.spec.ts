import {
  addPhotos,
  dragPhoto,
  expect,
  test,
  API_URL,
  answerPost,
  expectReadyToPost,
  fillFields,
  isPostListing,
  openSellPage,
  photoTiles,
  postButton,
  sellForm,
  tab,
} from './support';

/**
 * L6.5 and L6.6 around the happy path of create-listing.spec.ts: the form's checks, and
 * every answer of `POST /products` (plans/create-listing.md, "L6.6 post"). Server errors
 * are answered by the test; posts that succeed reach the local API.
 */

const title = (what: string) => `E2E ${what} ${Date.now()}`;

/** Long enough to fill the form while the upload is still running. */
const SLOW_STORAGE_MS = 4_000;

/** A JPEG header saying `width` × `height`, which is all the app reads before refusing. */
function jpegHeader(width: number, height: number) {
  const jfif = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const size = [height >> 8, height & 0xff, width >> 8, width & 0xff];
  const startOfFrame = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    ...size,
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  ];
  return Buffer.from([0xff, 0xd8, ...jfif, ...startOfFrame, 0xff, 0xd9]);
}

test('shows every missing field on the first tap, then keeps Post disabled until fixed', async ({
  page,
}) => {
  await openSellPage(page);

  await expect(postButton(page)).toBeEnabled();
  await postButton(page).click();

  for (const message of [
    'Vui lòng chọn danh mục.',
    'Vui lòng nhập tiêu đề từ 3 đến 120 ký tự.',
    'Vui lòng nhập mô tả từ 10 đến 5.000 ký tự.',
    'Vui lòng nhập giá bán là số đồng lớn hơn 0, ví dụ 150.000.',
    'Vui lòng chọn tình trạng.',
    'Vui lòng chọn địa điểm.',
  ]) {
    // Exactly one message per field.
    await expect(page.getByText(message, { exact: true })).toHaveCount(1);
  }
  await expect(page.getByText(/^Vui lòng thêm ít nhất 1 ảnh/)).toBeVisible();
  await expect(postButton(page)).toBeDisabled();

  await sellForm(page).getByLabel('Giá bán (VNĐ)').fill('1.5');
  await addPhotos(page, ['photo-a.jpg']);
  await fillFields(page, title('validation'));
  await expect(sellForm(page).getByLabel('Giá bán (VNĐ)')).toHaveValue('6.990.000');
  await expectReadyToPost(page);
  await expect(page.getByText(/^Vui lòng/)).toHaveCount(0);
});

test('keeps Post disabled while files upload, and says why', async ({ page }) => {
  // Storage answers slowly, so the upload is still running while the form is filled.
  await page.route(
    (url) => url.port === '4566',
    async (route) => {
      if (route.request().method() === 'PUT') {
        await new Promise((resolve) => setTimeout(resolve, SLOW_STORAGE_MS));
      }
      await route.fallback();
    },
  );
  await openSellPage(page);
  await addPhotos(page, ['photo-a.jpg']);
  await fillFields(page, title('waiting'));

  await expect(postButton(page)).toBeDisabled();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đang tải ảnh và video lên' }),
  ).toBeVisible();
  await expectReadyToPost(page);
});

test('marks the fields the server refused (400)', async ({ page }) => {
  await openSellPage(page);
  await addPhotos(page, ['photo-a.jpg']);
  await fillFields(page, title('fields'));
  await expectReadyToPost(page);

  await answerPost(
    page,
    400,
    { code: 'VALIDATION_ERROR', details: [{ field: 'price' }, { field: 'locationId' }] },
    { times: 1 },
  );
  await postButton(page).click();

  await expect(
    page.getByText('Vui lòng nhập giá bán là số đồng lớn hơn 0, ví dụ 150.000.'),
  ).toBeVisible();
  await expect(page.getByText('Vui lòng chọn địa điểm.')).toBeVisible();
  await expect(sellForm(page).getByLabel('Giá bán (VNĐ)')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { name: 'Hình ảnh sản phẩm' })).toBeVisible();

  // Disabled until every field the server refused has been changed.
  await expect(postButton(page)).toBeDisabled();
  await sellForm(page).getByLabel('Giá bán (VNĐ)').fill('7.000.000');
  await expect(postButton(page)).toBeDisabled();
  await sellForm(page).getByLabel('Địa điểm').selectOption({ label: 'Đà Nẵng' });
  await expect(page.getByText(/^Vui lòng/)).toHaveCount(0);
  await expect(postButton(page)).toBeEnabled();
});

test('keeps the draft and its key through failed posts, then posts once', async ({ page }) => {
  const keys: string[] = [];
  page.on('request', (request) => {
    if (isPostListing(request)) {
      keys.push(request.headers()['idempotency-key']);
    }
  });
  const listingTitle = title('retry');
  await openSellPage(page);
  await addPhotos(page, ['photo-a.jpg']);
  await fillFields(page, listingTitle);
  await expectReadyToPost(page);

  // The connection drops.
  await page.route(
    (url) => url.pathname.endsWith('/products'),
    (route) =>
      isPostListing(route.request()) ? route.abort('internetdisconnected') : route.fallback(),
    { times: 1 },
  );
  await postButton(page).click();
  await expect(page.getByText(/Vui lòng kiểm tra mạng rồi bấm Đăng tin lại/)).toBeVisible();

  // The server fails.
  await answerPost(page, 500, { code: 'INTERNAL_ERROR' }, { times: 1 });
  const failed = page.waitForResponse((response) => isPostListing(response.request()));
  await postButton(page).click();
  expect((await failed).status()).toBe(500);
  await expect(page.getByText(/Vui lòng kiểm tra mạng rồi bấm Đăng tin lại/).first()).toBeVisible();
  await expect(sellForm(page).getByLabel('Tiêu đề')).toHaveValue(listingTitle);
  await expect(photoTiles(page)).toHaveCount(1);

  // Posting again reaches the API with the same key.
  const created = page.waitForResponse((response) => isPostListing(response.request()));
  await postButton(page).click();
  const response = await created;
  expect([201, 202], await response.text()).toContain(response.status());
  await expect(tab(page, 'Quản lý tin')).toHaveAttribute('aria-current', 'page');

  expect(keys).toHaveLength(3);
  expect(new Set(keys).size).toBe(1);

  // The posted draft is gone; the next one starts empty.
  await tab(page, 'Đăng tin').click();
  await expect(sellForm(page).getByLabel('Tiêu đề')).toHaveValue('');
  await expect(photoTiles(page)).toHaveCount(0);
});

test('says a file cannot be used (409), keeping the draft', async ({ page }) => {
  await openSellPage(page);
  await addPhotos(page, ['photo-a.jpg']);
  await fillFields(page, title('conflict'));
  await expectReadyToPost(page);

  await answerPost(page, 409, { code: 'CONFLICT' }, { times: 1 });
  await postButton(page).click();

  await expect(page.getByText(/có tệp máy chủ không dùng được/)).toBeVisible();
  await expect(photoTiles(page)).toHaveCount(1);
  await expect(sellForm(page).getByLabel('Tiêu đề')).not.toHaveValue('');
});

test('opens the listing a reused key already made (422)', async ({ page, request }) => {
  const feed = await request.get(`${API_URL}/products?limit=1`);
  const [existing] = (await feed.json()).data as { id: string; title: string }[];

  await openSellPage(page);
  await addPhotos(page, ['photo-a.jpg']);
  await fillFields(page, title('reused'));
  await expectReadyToPost(page);

  await answerPost(
    page,
    422,
    { code: 'IDEMPOTENCY_KEY_REUSED', details: { productId: existing.id } },
    { times: 1 },
  );
  await postButton(page).click();

  await expect(page.getByText('Tin này đã được đăng trước đó.')).toBeVisible();
  await expect(page.getByText(existing.title).first()).toBeVisible();

  // The listing replaced the form in the history; the next draft starts empty.
  await page.getByRole('button', { name: 'Quay lại' }).last().click();
  await tab(page, 'Đăng tin').click();
  await expect(sellForm(page).getByLabel('Tiêu đề')).toHaveValue('');
  await expect(photoTiles(page)).toHaveCount(0);
});

test('refuses files the listing cannot take, in one toast, without a tile', async ({ page }) => {
  await openSellPage(page);
  await page.getByLabel('Thêm ảnh', { exact: true }).setInputFiles([
    { name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 not a photo') },
    { name: 'huge.jpg', mimeType: 'image/jpeg', buffer: jpegHeader(12_000, 9_000) },
  ]);

  await expect(page.getByText(/Vui lòng chọn ảnh JPG, PNG hoặc WebP \(doc\.pdf\)\./)).toBeVisible();
  await expect(page.getByText(/không quá 50 MP.*\(huge\.jpg\)\./)).toBeVisible();
  await expect(photoTiles(page)).toHaveCount(0);
});

test('reorders photos by dragging or from the viewer, and removes one with ×', async ({ page }) => {
  await openSellPage(page);
  await addPhotos(page, ['photo-a.jpg', 'photo-b.jpg', 'photo-a.jpg']);
  const pictures = photoTiles(page).locator('img');
  await expect(pictures).toHaveCount(3, { timeout: 60_000 });
  const before = await pictures.evaluateAll((images) =>
    images.map((image) => image.getAttribute('src')),
  );

  // The last photo, dragged onto the first, becomes the cover; the others move up.
  await dragPhoto(page, 2, 0);
  await expect(pictures.nth(0)).toHaveAttribute('src', before[2] ?? '');
  await expect(pictures.nth(1)).toHaveAttribute('src', before[0] ?? '');
  await expect(photoTiles(page).first()).toContainText('Ảnh bìa');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Held and let go without moving: nothing moves, nothing opens.
  await dragPhoto(page, 1, 1);
  await expect(pictures.nth(1)).toHaveAttribute('src', before[0] ?? '');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A quick tap still opens the photo rather than dragging it; the viewer can make it the
  // cover, for those who cannot drag.
  await photoTiles(page)
    .nth(1)
    .getByRole('button', { name: /^Ảnh 2/ })
    .tap();
  await page
    .getByRole('dialog', { name: 'Ảnh 2' })
    .getByRole('button', { name: 'Đặt làm ảnh bìa' })
    .tap();
  await expect(pictures.nth(0)).toHaveAttribute('src', before[0] ?? '');
  await expect(pictures.nth(1)).toHaveAttribute('src', before[2] ?? '');

  await page.getByRole('button', { name: 'Xoá Ảnh 2' }).click();
  await expect(photoTiles(page)).toHaveCount(2);
  await expect(pictures.nth(1)).toHaveAttribute('src', before[1] ?? '');
});

test('keeps the draft as sent while the post is on its way', async ({ page }) => {
  await openSellPage(page);
  await addPhotos(page, ['photo-a.jpg', 'photo-b.jpg']);
  await fillFields(page, title('in flight'));
  await expectReadyToPost(page);
  const pictures = photoTiles(page).locator('img');
  const cover = await pictures.first().getAttribute('src');

  // The API answers slowly.
  let answer: () => void = () => {};
  const answered = new Promise<void>((resolve) => {
    answer = resolve;
  });
  await page.route(
    (url) => url.pathname.endsWith('/products'),
    async (route) => {
      if (isPostListing(route.request())) {
        await answered;
      }
      await route.fallback();
    },
    { times: 1 },
  );
  await postButton(page).click();

  const sending = page.getByRole('main').getByRole('button', { name: 'Đang đăng…' });
  await expect(sending).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Xoá Ảnh 1' })).toBeDisabled();
  await expect(page.getByLabel('Thêm ảnh', { exact: true })).toBeDisabled();
  await expect(sellForm(page).getByLabel('Tiêu đề')).toBeDisabled();
  await dragPhoto(page, 1, 0);
  await expect(pictures.first()).toHaveAttribute('src', cover ?? '');

  answer();
  await expect(tab(page, 'Quản lý tin')).toHaveAttribute('aria-current', 'page');
});
