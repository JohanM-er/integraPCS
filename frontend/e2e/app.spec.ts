import { test, expect } from '@playwright/test';

test.describe('integraPCS Application', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('should display the homepage', async ({ page }) => {
    // Check if header is visible
    await expect(page.getByRole('heading', { name: /integrapcs/i })).toBeVisible();

    // Check if welcome message is visible
    await expect(
      page.getByRole('heading', { name: /welcome to integrapcs/i })
    ).toBeVisible();

    // Check page title
    await expect(page).toHaveTitle(/vite/i);
  });

  test('should have proper meta tags', async ({ page }) => {
    // Check viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');

    // Check description meta tag (if exists)
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: /integrapcs/i })).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('heading', { name: /integrapcs/i })).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByRole('heading', { name: /integrapcs/i })).toBeVisible();
  });

  test('should have no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected errors (like 404 for favicon, etc.)
    const unexpectedErrors = consoleErrors.filter(
      error =>
        !error.includes('favicon') &&
        !error.includes('Failed to load resource') &&
        !error.includes('net::ERR_')
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    // Check for proper heading hierarchy
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThan(0);

    // Check for main landmark
    await expect(page.locator('main')).toBeVisible();

    // Check for header landmark
    await expect(page.locator('header')).toBeVisible();
  });
});
