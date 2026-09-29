import type { Page } from '@playwright/test';

import {
  addPhotos,
  expect,
  expectReadyToPost,
  fillFields,
  isPostListing,
  openSellPage,
  postButton,
  tab,
  test,
} from './support';

/**
 * L7 acceptance: "Quản lý tin" against the real stack. A seller posts two listings, finds
 * them on the right tab, then marks one sold and hides and shows again the other, with the
 * tabs' totals following. Only "Đã bán" and "Đã ẩn" are counted: the other specs post as
 * the same dev user in parallel, so "Đang hiển thị" grows under this one.
 */

const title = (what: string) => `E2E L7 ${what} ${Date.now()}`;
/** The media worker publishing a one-photo listing on the local stack. */
const PUBLISH_TIMEOUT_MS = 90_000;

const statusTab = (page: Page, name: string) =>
  page.getByRole('tab', { name: new RegExp(`^${name}`) });
const card = (page: Page, listingTitle: string) =>
  page.getByRole('tabpanel').getByRole('article').filter({ hasText: listingTitle });

/** From the start, so the lists are fetched anew. */
async function openMyListings(page: Page) {
  await page.goto('/');
  await tab(page, 'Quản lý tin').click();
  await expect(page.getByRole('tablist', { name: 'Trạng thái tin' })).toBeVisible();
}

/** The "N tin" above the open tab's list; absent while the tab is empty. */
async function tabTotal(page: Page) {
  const summary = page.getByRole('tabpanel').getByText(/^\d+ tin$/);
  if (!(await summary.isVisible())) {
    return 0;
  }
  return Number.parseInt((await summary.textContent()) ?? '0', 10);
}

async function totalOf(page: Page, name: string) {
  await statusTab(page, name).click();
  await expect(statusTab(page, name)).toHaveAttribute('aria-selected', 'true');
  // Settled: no skeleton while the tab's first page loads.
  await expect(page.getByRole('status', { name: 'Đang tải tin của bạn' })).toHaveCount(0);
  return tabTotal(page);
}

/** Posts a one-photo listing; the app then opens My listings. */
async function postListing(page: Page, listingTitle: string) {
  await openSellPage(page);
  await addPhotos(page, ['photo-a.jpg']);
  await fillFields(page, listingTitle);
  await expectReadyToPost(page);

  const created = page.waitForResponse((response) => isPostListing(response.request()));
  await postButton(page).click();
  const response = await created;
  expect([201, 202], await response.text()).toContain(response.status());
  await expect(tab(page, 'Quản lý tin')).toHaveAttribute('aria-current', 'page');
}

async function openCardActions(page: Page, listingTitle: string) {
  await card(page, listingTitle)
    .getByRole('button', { name: `Tuỳ chọn cho ${listingTitle}` })
    .click();
}

test('finds posted listings on their tab, then marks sold, hides and shows again', async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  const soldTitle = title('sold');
  const hiddenTitle = title('hidden');

  // ---- Posted listings are on the tab of their status ----

  // The page opens the listing's tab, and follows it to "Đang hiển thị" once published.
  for (const listingTitle of [soldTitle, hiddenTitle]) {
    await postListing(page, listingTitle);
    await expect(statusTab(page, 'Đang hiển thị')).toHaveAttribute('aria-selected', 'true', {
      timeout: PUBLISH_TIMEOUT_MS,
    });
    await expect(card(page, listingTitle)).toBeVisible();
  }

  // Once the worker has published them, both show to buyers.
  await expect(async () => {
    await openMyListings(page);
    await expect(card(page, soldTitle)).toBeVisible({ timeout: 5_000 });
    await expect(card(page, hiddenTitle)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: PUBLISH_TIMEOUT_MS });
  await expect(card(page, soldTitle)).toContainText(/Đã đăng · /);

  const sold = await totalOf(page, 'Đã bán');
  const archived = await totalOf(page, 'Đã ẩn');

  // ---- Đánh dấu đã bán: asks first, then moves to "Đã bán" for good ----

  await statusTab(page, 'Đang hiển thị').click();
  await openCardActions(page, soldTitle);
  await page.getByRole('button', { name: 'Đánh dấu đã bán' }).click();
  const confirm = page.getByRole('dialog').filter({ hasText: 'Đánh dấu đã bán?' });
  await confirm.getByRole('button', { name: 'Chưa bán' }).click();
  await expect(card(page, soldTitle)).toBeVisible();

  await openCardActions(page, soldTitle);
  await page.getByRole('button', { name: 'Đánh dấu đã bán' }).click();
  await confirm.getByRole('button', { name: 'Đã bán' }).click();
  await expect(page.getByText('Đã đánh dấu đã bán')).toBeVisible();
  await expect(card(page, soldTitle)).toHaveCount(0);
  // The dialog locks the page's scrolling while open; it must not stay locked.
  await expect(page.locator('.zaui-page.disable-scrolling')).toHaveCount(0);

  await statusTab(page, 'Đã bán').click();
  await expect(card(page, soldTitle)).toContainText(/Đã bán · /);
  await expect(card(page, soldTitle).getByRole('button', { name: /^Tuỳ chọn cho/ })).toHaveCount(0);
  await expect.poll(() => tabTotal(page)).toBe(sold + 1);

  // ---- Ẩn tin, then Hiện lại ----

  await statusTab(page, 'Đang hiển thị').click();
  await openCardActions(page, hiddenTitle);
  await page.getByRole('button', { name: 'Ẩn tin' }).click();
  await expect(page.getByText('Đã ẩn tin')).toBeVisible();
  await expect(card(page, hiddenTitle)).toHaveCount(0);

  await statusTab(page, 'Đã ẩn').click();
  await expect(card(page, hiddenTitle)).toContainText(/Đã ẩn · /);
  await expect.poll(() => tabTotal(page)).toBe(archived + 1);

  await openCardActions(page, hiddenTitle);
  await page.getByRole('button', { name: 'Hiện lại' }).click();
  await expect(page.getByText('Đã hiện lại tin')).toBeVisible();
  await expect(card(page, hiddenTitle)).toHaveCount(0);
  await expect.poll(() => tabTotal(page)).toBe(archived);

  await statusTab(page, 'Đang hiển thị').click();
  await expect(card(page, hiddenTitle)).toBeVisible();
});
