import { expect, tab, test } from './support';

// The dev sign-in shares 0900000000 without Zalo (backend DEV_PHONE_NUMBER). The first
// GET /me answers no number, so the notice shows however earlier runs left the account.
test('activates the account from the profile, then the sell page asks no more', async ({
  page,
}) => {
  await page.route(
    (url) => url.pathname.endsWith('/api/v1/me'),
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { data: { ...body.data, phoneNumber: null } } });
    },
    { times: 1 },
  );

  await page.goto('/');
  await tab(page, 'Đăng tin').click();
  const notice = page.getByRole('complementary', { name: 'Hiển thị thông tin liên hệ' });
  await expect(notice).toBeVisible();

  await tab(page, 'Cá nhân').click();
  await expect(page.getByText('Kích hoạt tài khoản')).toBeVisible();
  const shared = page.waitForResponse((response) => response.url().endsWith('/me/phone-number'));
  await page.getByRole('button', { name: 'Kích hoạt ngay' }).click();
  expect((await shared).status()).toBe(200);
  await expect(page.getByText('Đã chia sẻ. Người mua có thể liên hệ với bạn.')).toBeVisible();
  await expect(page.getByText('Kích hoạt tài khoản')).toHaveCount(0);
  await expect(page.getByText('0900 000 000 · Đã xác minh qua Zalo')).toBeVisible();

  await tab(page, 'Đăng tin').click();
  await expect(page.getByRole('heading', { name: 'Hình ảnh sản phẩm' })).toBeVisible();
  await expect(notice).toHaveCount(0);
});
