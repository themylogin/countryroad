import { expect, test } from '@playwright/test';

test('document title is countryroad', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('countryroad');
});

test('script renders the road drawing and the control panel', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});

test.describe('without scripts', () => {
  test.use({ javaScriptEnabled: false });

  test('served HTML has an empty root element', async ({ page }) => {
    await page.goto('./');
    const root = page.locator('#app');
    await expect(root).toBeAttached();
    expect(await root.innerHTML()).toBe('');
  });
});

test('page loads without console errors or failed asset requests', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(request.url()));
  page.on('response', (response) => {
    if (!response.ok()) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  const grass = page.waitForResponse((response) => /grass-.*\.webp$/.test(response.url()));
  await page.goto('./');
  expect((await grass).ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
