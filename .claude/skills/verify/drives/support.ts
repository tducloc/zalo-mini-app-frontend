import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Locator, test as base } from '@playwright/test';

export { expect };

const out = process.env.VERIFY_DRIVE_OUT ?? '';
const apiUrl = process.env.E2E_API_URL ?? '';
const isApiOwned = process.env.VERIFY_API_OWNED === '1';
const STORAGE_PORT = '4566';

const isRead = (method: string) => ['GET', 'HEAD', 'OPTIONS'].includes(method);
// Signing in with the dev token upserts the dev user; every session does it.
const isSignIn = (url: URL) => url.pathname.endsWith('/auth/zalo');

/** Waits until `locator` stops moving: pages slide in, and a proof taken mid-slide shows two pages. */
export async function settled(locator: Locator) {
  let lastX: number | undefined;
  await expect
    .poll(async () => {
      const x = (await locator.boundingBox())?.x;
      const isResting = x !== undefined && x === lastX;
      lastX = x;
      return isResting;
    })
    .toBe(true);
}

type Fixtures = {
  /** Saves a screenshot and an ARIA snapshot of the page, numbered in step order. */
  proof: (step: string) => Promise<void>;
  /** Every API request the app made, as "METHOD /path?query -> status". */
  apiCalls: string[];
};

export const test = base.extend<Fixtures>({
  apiCalls: [
    async ({ page }, use) => {
      const calls: string[] = [];
      const blocked: string[] = [];
      page.on('response', (response) => {
        const url = response.url();
        if (url.startsWith(apiUrl)) {
          calls.push(
            `${response.request().method()} ${url.slice(apiUrl.length)} -> ${response.status()}`,
          );
        }
      });

      // A borrowed API belongs to another session: its data must not change under it.
      if (!isApiOwned) {
        await page.route(
          (url) => url.href.startsWith(apiUrl) || url.port === STORAGE_PORT,
          (route) => {
            const request = route.request();
            if (isRead(request.method()) || isSignIn(new URL(request.url()))) {
              return route.fallback();
            }
            blocked.push(`${request.method()} ${request.url()}`);
            return route.abort('blockedbyclient');
          },
        );
      }

      await use(calls);

      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, 'api-calls.txt'), `${calls.join('\n')}\n`);
      expect(blocked, 'writes blocked on a borrowed API; launch with --api-port').toEqual([]);
    },
    { auto: true },
  ],

  proof: async ({ page }, use) => {
    let step = 0;
    await use(async (name) => {
      step += 1;
      const file = join(out, `${String(step).padStart(2, '0')}-${name}`);
      await page.screenshot({ path: `${file}.png` });
      writeFileSync(`${file}.aria.yml`, await page.locator('body').ariaSnapshot());
    });
  },
});
