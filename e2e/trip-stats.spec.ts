import { expect, test, type Page } from '@playwright/test';

async function openApp(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
}

function readStats(page: Page): Promise<Record<string, string>> {
  return page.locator('dl.trip-stats').evaluate((list) => {
    const values: Record<string, string> = {};
    for (const term of Array.from(list.querySelectorAll('dt'))) {
      values[term.textContent ?? ''] = term.nextElementSibling?.textContent ?? '';
    }
    return values;
  });
}

async function setSimulationSpeed(page: Page, factor: number): Promise<void> {
  const slider = page.getByRole('slider', { name: 'Simulation speed' });
  await slider.focus();
  for (let step = 1; step < factor; step += 1) {
    await page.keyboard.press('ArrowRight');
  }
}

test('shows the statistics below the Start button with their values on load', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('dl.trip-stats dt')).toHaveText([
    'Current speed',
    'Distance',
    'Time',
    'Average speed',
    'Overtakes completed',
  ]);
  const button = await page.getByRole('button', { name: 'Start' }).boundingBox();
  const list = await page.locator('dl.trip-stats').boundingBox();
  expect(list?.y ?? 0).toBeGreaterThan(button?.y ?? Infinity);
  const stats = await readStats(page);
  expect(stats['Current speed']).toMatch(/^\d+ km\/h$/);
  expect(stats.Distance).toBe('0.0 km');
  expect(stats.Time).toBe('0:00:00');
  expect(stats['Average speed']).toBe('–');
  expect(stats['Overtakes completed']).toBe('0');
});

test('counts time and distance while running', async ({ page }) => {
  await openApp(page);
  await setSimulationSpeed(page, 10);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(1500);
  const stats = await readStats(page);
  expect(stats.Time).not.toBe('0:00:00');
  expect(stats.Distance).not.toBe('0.0 km');
  expect(stats['Average speed']).toMatch(/^\d+ km\/h$/);
});

test('changes no statistic while paused', async ({ page }) => {
  await openApp(page);
  await setSimulationSpeed(page, 5);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(100);
  const paused = await readStats(page);
  await page.waitForTimeout(1000);
  expect(await readStats(page)).toEqual(paused);
});

test('refreshes the time at least 4 times per second at 10x', async ({ page }) => {
  await openApp(page);
  await setSimulationSpeed(page, 10);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(300);
  const seen: string[] = [];
  for (let sample = 0; sample < 20; sample += 1) {
    const time = (await readStats(page)).Time;
    if (seen[seen.length - 1] !== time) {
      seen.push(time);
    }
    await page.waitForTimeout(50);
  }
  expect(seen.length - 1).toBeGreaterThanOrEqual(4);
});
