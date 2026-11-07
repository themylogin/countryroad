import { expect, test, type Page } from '@playwright/test';

const SLIDERS = [
  { id: 'my-speed', name: 'My speed', min: '80', max: '180', step: '5', value: '130', shown: '130 km/h' },
  { id: 'cars', name: 'Cars', min: '0', max: '100', step: '1', value: '15', shown: '15' },
  { id: 'semis', name: 'Semis', min: '0', max: '20', step: '1', value: '3', shown: '3' },
  { id: 'slow-trucks', name: 'Slow trucks', min: '0', max: '10', step: '1', value: '2', shown: '2' },
  { id: 'my-gap', name: 'My overtaking gap', min: '1', max: '6', step: '0.1', value: '6', shown: '6.0 s' },
  { id: 'simulation-speed', name: 'Simulation speed', min: '1', max: '10', step: '1', value: '1', shown: '1×' },
];

async function openApp(page: Page): Promise<void> {
  const grass = page.waitForResponse((response) => /grass-.*\.webp$/.test(response.url()));
  await page.goto('./');
  await grass;
  await page.waitForTimeout(200);
}

function canvasSnapshot(page: Page): Promise<string> {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
}

test('shows six sliders with their ranges, steps, and defaults', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('slider')).toHaveCount(6);
  for (const slider of SLIDERS) {
    const input = page.getByRole('slider', { name: slider.name, exact: true });
    await expect(input).toHaveValue(slider.value);
    await expect(input).toHaveAttribute('min', slider.min);
    await expect(input).toHaveAttribute('max', slider.max);
    await expect(input).toHaveAttribute('step', slider.step);
    await expect(page.locator(`output[for="${slider.id}"]`)).toHaveText(slider.shown);
  }
  await expect(page.getByText('Vehicles per direction on 10 km of road.')).toBeVisible();
});

test('moves my speed in 5 km/h steps', async ({ page }) => {
  await openApp(page);
  const speed = page.getByRole('slider', { name: 'My speed' });
  await speed.focus();
  await page.keyboard.press('ArrowRight');
  await expect(speed).toHaveValue('135');
  await expect(page.locator('output[for="my-speed"]')).toHaveText('135 km/h');
});

test('places the control panel to the right of the road', async ({ page }) => {
  await openApp(page);
  const panel = await page.locator('aside').boundingBox();
  const viewport = page.viewportSize();
  if (panel === null || viewport === null) {
    throw new Error('panel or viewport has no size');
  }
  expect(panel.x).toBeGreaterThan(viewport.width / 4);
  const roadPixelLeftOfPanel = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement, x: number) => {
    const context = canvas.getContext('2d');
    if (context === null) {
      return false;
    }
    const row = context.getImageData(0, Math.floor(canvas.height / 2), Math.floor(x), 1).data;
    for (let index = 0; index < row.length; index += 4) {
      if (row[index] < 70 && row[index + 1] < 70 && row[index + 2] < 70) {
        return true;
      }
    }
    return false;
  }, panel.x);
  expect(roadPixelLeftOfPanel).toBe(true);
});

test('switches between Start and Pause', async ({ page }) => {
  await openApp(page);
  const start = page.getByRole('button', { name: 'Start' });
  await start.click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('moves the scene while running and freezes it while paused', async ({ page }) => {
  await openApp(page);
  const paused = await canvasSnapshot(page);
  await page.waitForTimeout(300);
  expect(await canvasSnapshot(page)).toBe(paused);

  await page.getByRole('button', { name: 'Start' }).click();
  const running = await canvasSnapshot(page);
  await page.waitForTimeout(300);
  expect(await canvasSnapshot(page)).not.toBe(running);

  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(100);
  const frozen = await canvasSnapshot(page);
  await page.waitForTimeout(300);
  expect(await canvasSnapshot(page)).toBe(frozen);
});

test('draws grass at the left edge and the red user car near the bottom', async ({ page }) => {
  await openApp(page);
  const colors = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (context === null) {
      return null;
    }
    const corner = context.getImageData(5, 5, 1, 1).data;
    const bottomTop = Math.floor(canvas.height * 0.8);
    const bottom = context.getImageData(0, bottomTop, canvas.width, canvas.height - bottomTop).data;
    let redPixels = 0;
    for (let index = 0; index < bottom.length; index += 4) {
      if (bottom[index] > 170 && bottom[index + 1] < 90 && bottom[index + 2] < 90) {
        redPixels += 1;
      }
    }
    return { corner: [corner[0], corner[1], corner[2]], redPixels };
  });
  if (colors === null) {
    throw new Error('canvas has no 2D context');
  }
  const [red, green, blue] = colors.corner;
  expect(green).toBeGreaterThan(red);
  expect(green).toBeGreaterThan(blue);
  expect(colors.redPixels).toBeGreaterThan(10);
});
