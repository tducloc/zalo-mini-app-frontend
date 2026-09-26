import { join } from 'node:path';

import { expect, type Page, type Request, type Route, test } from '@playwright/test';

export { expect, test };

/** The API the frontend on E2E_BASE_URL talks to, for setting up a test. */
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3002/api/v1';

// Playwright loads specs as CommonJS here (no "type": "module" in package.json).
export const fixture = (name: string) => join(__dirname, 'fixtures', name);

/** The tab bar's button; the form has its own "Đăng tin" to post. */
export const tab = (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('button', { name });

export async function openSellPage(page: Page) {
  await page.goto('/');
  await tab(page, 'Đăng tin').click();
  await expect(page.getByRole('heading', { name: 'Hình ảnh sản phẩm' })).toBeVisible();
}

export const photoTiles = (page: Page) => page.getByRole('listitem', { name: /^Ảnh \d+$/ });

/** How long a finger rests before a drag starts; the form waits 350 ms. */
const HOLD_MS = 500;
const DRAG_STEPS = 10;

/**
 * Holds the photo tile at `from`, then drags it onto the one at `to`, with real touch
 * events: the form's drag listens to touch only.
 */
export async function dragPhoto(page: Page, from: number, to: number) {
  const center = async (index: number) => {
    const box = await photoTiles(page).nth(index).boundingBox();
    if (!box) {
      throw new Error(`photo tile ${index} is not on screen`);
    }
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const start = await center(from);
  const end = await center(to);
  const touch = await page.context().newCDPSession(page);

  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await page.waitForTimeout(HOLD_MS);
  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    const x = start.x + ((end.x - start.x) * step) / DRAG_STEPS;
    const y = start.y + ((end.y - start.y) * step) / DRAG_STEPS;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
  // dnd-kit blocks clicks until 50 ms after a drag ends; a tap sooner would be swallowed.
  // A page timer set now runs after dnd-kit's.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
}

export const postButton = (page: Page) =>
  page.getByRole('main').getByRole('button', { name: 'Đăng tin', exact: true });

/**
 * Waits until Post can go: nothing is being checked or uploaded (Post is disabled until
 * then) and no file failed (Post stays enabled for that until tapped, so check it here).
 */
export async function expectReadyToPost(page: Page) {
  await expect(postButton(page)).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: /, có lỗi\./ })).toHaveCount(0);
}

export async function addPhotos(page: Page, names: string[]) {
  await page.getByLabel('Thêm ảnh', { exact: true }).setInputFiles(names.map(fixture));
}

/** The sell form; the home page stays in the DOM behind it, with its own filters. */
export const sellForm = (page: Page) => page.getByRole('form', { name: 'Tin đăng mới' });

export async function fillFields(page: Page, title: string) {
  const form = sellForm(page);
  await form.getByLabel('Danh mục').selectOption({ label: 'Điện tử' });
  await form.getByLabel('Tiêu đề').fill(title);
  await form.getByLabel('Mô tả').fill('Máy dùng tốt, pin 90%, đủ hộp và cáp.');
  await form.getByLabel('Giá bán (VNĐ)').fill('6.990.000');
  await form.getByLabel('Như mới').check();
  await form.getByLabel('Địa điểm').selectOption({ label: 'Hà Nội' });
}

/** `POST /products`, not the feed's `GET /products?…`. */
export const isPostListing = (request: Request) =>
  request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/products');

/** Answers `POST /products` with `status` and an error envelope, once or every time. */
export async function answerPost(
  page: Page,
  status: number,
  error: { code: string; details?: unknown },
  options: { times?: number } = {},
) {
  await page.route(
    (url) => url.pathname.endsWith('/products'),
    (route: Route) =>
      isPostListing(route.request())
        ? route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: 'Mocked.', ...error } }),
          })
        : route.fallback(),
    options,
  );
}
