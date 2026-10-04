import type { Page, Request } from '@playwright/test';

import { expect, skipReelsGestureHint, tab, test } from './support';

/** The fake DSN Vite runs with, e.g. https://public@o1.ingest.sentry.test/2. Never a real one. */
const SENTRY_DSN = process.env.E2E_SENTRY_DSN;

test.beforeEach(({ page }) => skipReelsGestureHint(page));

/** Makes the Reels page throw while it renders: the first reel arrives without its seller. */
async function breakReels(page: Page) {
  await page.route(
    (url) => url.pathname.endsWith('/api/v1/reels'),
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data[0].seller = null;
      await route.fulfill({ response, json: body });
    },
  );
}

const errorScreen = (page: Page) =>
  page.getByRole('status').filter({ has: page.getByRole('heading', { name: 'Đã có lỗi xảy ra' }) });

async function openBrokenReels(page: Page) {
  await breakReels(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tin đăng mới' })).toBeVisible();
  await tab(page, 'Reels').click();
}

test('a page that throws shows the error screen and the tab bar still works', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await openBrokenReels(page);

  await expect(errorScreen(page)).toBeVisible();
  await expect(errorScreen(page).getByRole('button', { name: 'Thử lại' })).toBeVisible();
  await expect(tab(page, 'Reels')).toHaveAttribute('aria-current', 'page');
  // Not swallowed: React still logs the error.
  expect(consoleErrors.join('\n')).toContain(
    'The above error occurred in the <ReelOverlay> component',
  );

  await tab(page, 'Trang chủ').click();

  await expect(tab(page, 'Trang chủ')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Tin đăng mới' })).toBeInViewport();

  await tab(page, 'Cá nhân').click();

  await expect(tab(page, 'Cá nhân')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Số điện thoại liên hệ' })).toBeVisible();
});

test('sends crashes and traces to Sentry', async ({ page }) => {
  test.skip(!SENTRY_DSN, 'Start Vite with VITE_SENTRY_DSN=$E2E_SENTRY_DSN');

  const { host } = new URL(SENTRY_DSN!);
  const envelopes: SentryItem[][] = [];
  await page.route(`https://${host}/**`, async (route) => {
    envelopes.push(parseEnvelope(route.request()));
    await route.fulfill({ status: 200, json: {} });
  });
  const items = () => envelopes.flat();
  const exceptions = () =>
    items().flatMap((item) => (item.exception?.values ?? []).map((value) => ({ item, value })));

  // The error boundary's report carries the React component stack.
  const boundaryReport = () => items().find((item) => item.contexts?.react?.componentStack);
  const pageSpans = () =>
    items()
      .filter((item) => item.type === 'span' && item.is_segment)
      .map((span) => `${span.attributes?.['sentry.op']?.value} ${span.name}`);

  // Usually before Sentry loads (3 s after the load event), so the report waits in the buffer.
  await openBrokenReels(page);
  await expect(errorScreen(page)).toBeVisible();

  await expect.poll(() => Boolean(boundaryReport())).toBe(true);
  const crash = boundaryReport()!;
  expect(JSON.stringify(crash.exception)).toContain("reading 'name'");
  expect(crash.contexts?.react?.componentStack).toContain('ReelOverlay');
  expect(crash.release).toMatch(/^marketplace-frontend@/);
  expect(crash.environment).toBe('local');
  expect(crash.user?.id).toBeTruthy();
  expect(crash.user).not.toHaveProperty('ip_address');
  expect(crash.user).not.toHaveProperty('username');

  // Traces are named after the page: the first load, then each tab.
  await expect.poll(pageSpans).toContain('pageload /');

  await tab(page, 'Cá nhân').click();

  await expect.poll(pageSpans).toContain('navigation /profile');
  // The first load's LCP goes out on its own once the user moves on.
  await expect
    .poll(() => items().some((item) => item.attributes?.['sentry.op']?.value === 'ui.webvital.lcp'))
    .toBe(true);

  await page.evaluate(() => {
    void Promise.reject(new Error('e2e unhandled rejection'));
  });

  await expect
    .poll(() => exceptions().some(({ value }) => value.value === 'e2e unhandled rejection'))
    .toBe(true);
});

type SentryItem = {
  type?: string;
  name?: string;
  is_segment?: boolean;
  attributes?: Record<string, { value?: unknown }>;
  release?: string;
  environment?: string;
  user?: Record<string, unknown>;
  contexts?: { react?: { componentStack?: string } };
  exception?: { values?: { type?: string; value?: string }[] };
};

/**
 * An envelope is lines of JSON: a header, then an item header and its payload, and so on.
 * A span item holds many spans.
 */
function parseEnvelope(request: Request) {
  const lines = (request.postData() ?? '').split('\n').filter(Boolean);
  const payloads: SentryItem[] = [];
  for (let index = 1; index + 1 < lines.length; index += 2) {
    const { type } = JSON.parse(lines[index]);
    const payload = JSON.parse(lines[index + 1]);
    const spans: SentryItem[] = type === 'span' ? payload.items : [payload];
    payloads.push(...spans.map((item) => ({ type, ...item })));
  }
  return payloads;
}
