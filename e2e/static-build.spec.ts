import { expect, test } from '@playwright/test';

test('page works when served from a sub-path', async ({ page, baseURL }) => {
  const siteRoot = new URL('./', baseURL);
  const subPathRoot = new URL('nested/path/', siteRoot);

  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (!requestUrl.startsWith(subPathRoot.href)) {
      await route.fulfill({ status: 404 });
      return;
    }
    const pathInSite = requestUrl.slice(subPathRoot.href.length);
    const response = await route.fetch({ url: new URL(pathInSite, siteRoot).href });
    await route.fulfill({ response });
  });

  const failedRequests: string[] = [];
  page.on('response', (response) => {
    if (!response.ok()) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  const grass = page.waitForResponse(
    (response) => response.url().startsWith(subPathRoot.href) && /grass-.*\.webp$/.test(response.url()),
  );
  await page.goto(subPathRoot.href);

  expect((await grass).ok()).toBe(true);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  expect(failedRequests).toEqual([]);
});
