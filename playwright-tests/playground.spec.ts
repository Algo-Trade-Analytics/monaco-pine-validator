import { test, expect } from '@playwright/test';

test.describe('Playground validator flow', () => {
  test('shows validation results for snippets', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Pine Validator Playground' })).toBeVisible();

    await page.getByRole('button', { name: 'Moving Average' }).click();
    const summary = page.locator('.panel-content section div').first();
    const movingSummaryText = (await summary.textContent())?.trim() ?? '';

    await page.getByRole('button', { name: 'Broken Script' }).click();

    await expect(summary).not.toHaveText(movingSummaryText);
    await expect(page.locator('.validation-item.error').first()).toContainText(
      "Calls to 'strategy.*' are not allowed in indicators."
    );
  });
});
