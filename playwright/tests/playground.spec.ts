import { test, expect } from '@playwright/test';

async function ensureWorkerReady(page: import('@playwright/test').Page) {
  await expect(page.getByText('Validation Output')).toBeVisible();
  await expect(page.getByText('No validation issues detected')).toBeVisible();
  await expect(page.getByText('Worker Error')).toHaveCount(0);
}

test.describe('Validator Playground', () => {
  test('renders the default script without worker errors', async ({ page }) => {
    await page.goto('/');
    await ensureWorkerReady(page);
    await expect(page.getByText('Validator Playground')).toBeVisible();
  });

  test('surfaces diagnostics after introducing a version error', async ({ page }) => {
    await page.goto('/');
    await ensureWorkerReady(page);

    await page.evaluate(() => {
      const models = (window as any).monaco?.editor?.getModels?.();
      if (models && models[0]) {
        models[0].setValue('indicator("Missing Version")\nplot(close)\n');
      }
    });

    await expect(page.getByRole('heading', { name: 'Errors' }).first()).toBeVisible();
  });
});
