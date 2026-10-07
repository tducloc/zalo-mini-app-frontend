import {
  addPhotos,
  dragPhoto,
  expect,
  test,
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
 * L6.6 around the happy path of create-listing.spec.ts: what needs a real browser or the
 * real API (plans/create-listing.md, "L6.6 post"). The form's checks and the way it reads
 * each refused post are component tests (tests/create-listing-form.ui.test.tsx).
 */

const title = (what: string) => `E2E ${what} ${Date.now()}`;

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

test('does not reorder photos while the post is on its way', async ({ page }) => {
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

  await expect(page.getByRole('main').getByRole('button', { name: 'Đang đăng…' })).toBeDisabled();
  await dragPhoto(page, 1, 0);
  await expect(pictures.first()).toHaveAttribute('src', cover ?? '');

  answer();
  await expect(tab(page, 'Quản lý tin')).toHaveAttribute('aria-current', 'page');
});
