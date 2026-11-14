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
  const output = page.locator('output[for="simulation-speed"]');
  await page.getByRole('slider', { name: 'Simulation speed' }).focus();
  for (let press = 0; press < 5 && (await output.textContent()) !== `${factor}×`; press += 1) {
    await page.keyboard.press('ArrowRight');
  }
  await expect(output).toHaveText(`${factor}×`);
}

const REASON = new RegExp(
  `^(${[
    'Oncoming \\d+ m away, need \\d+ m',
    'Another vehicle is overtaking\\.',
    'The queue ahead has more than 12 vehicles\\.',
    'No gap to return into: \\d+\\.\\d s between the cars, \\d+\\.\\d s needed\\.',
    'Too close to the vehicle ahead to pull out: \\d+ m gap, \\d+ m needed\\.',
    'The overtake takes more than 90 s at \\d+ km/h\\.',
    'The vehicle ahead can reach your overtaking speed\\.',
    'The vehicle ahead is not slower than My speed\\.',
  ].join('|')})$`,
);

function readHoldReason(page: Page): Promise<{ hidden: boolean; text: string }> {
  return page.locator('.hold-reason').evaluate((element: HTMLElement) => ({
    hidden: element.hidden,
    text: element.querySelector('p')?.textContent ?? '',
  }));
}

async function setToMaximum(page: Page, name: string): Promise<void> {
  await page.getByRole('slider', { name, exact: true }).focus();
  await page.keyboard.press('End');
}

function secondsOf(time: string): number {
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
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
  await setSimulationSpeed(page, 4);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(100);
  const paused = await readStats(page);
  const pausedReason = await readHoldReason(page);
  await page.waitForTimeout(1000);
  expect(await readStats(page)).toEqual(paused);
  expect(await readHoldReason(page)).toEqual(pausedReason);
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

test('passes about 60 s of simulated time per real second at 60x', async ({ page }) => {
  await openApp(page);
  await setSimulationSpeed(page, 60);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(5000);
  const seconds = secondsOf((await readStats(page)).Time);
  expect(seconds).toBeGreaterThanOrEqual(240);
  expect(seconds).toBeLessThanOrEqual(330);
});

test('shows no overtake reason on load', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.hold-reason')).toBeHidden();
  await expect(page.locator('.hold-reason hr')).toBeHidden();
  await expect(page.locator('.hold-reason p')).toBeHidden();
});

test('explains below the statistics why the car does not overtake in heavy traffic', async ({ page }) => {
  await openApp(page);
  await setToMaximum(page, 'Cars');
  await setToMaximum(page, 'Slow trucks');
  await setSimulationSpeed(page, 60);
  await page.getByRole('button', { name: 'Start' }).click();
  const shown = await page.waitForFunction(
    () => {
      const reason = document.querySelector<HTMLElement>('.hold-reason');
      const rule = reason?.querySelector('hr');
      const paragraph = reason?.querySelector('p');
      const list = document.querySelector('dl.trip-stats');
      if (!reason || reason.hidden || !rule || !paragraph || !list) {
        return null;
      }
      return {
        listBottom: list.getBoundingClientRect().bottom,
        ruleTop: rule.getBoundingClientRect().top,
        ruleBottom: rule.getBoundingClientRect().bottom,
        paragraphTop: paragraph.getBoundingClientRect().top,
        text: paragraph.textContent ?? '',
      };
    },
    null,
    { timeout: 15_000 },
  );
  const layout = await shown.jsonValue();
  if (layout === null) {
    throw new Error('the overtake reason did not show');
  }
  expect(layout.text).toMatch(REASON);
  expect(layout.ruleTop).toBeGreaterThanOrEqual(layout.listBottom);
  expect(layout.paragraphTop).toBeGreaterThanOrEqual(layout.ruleBottom);
});
