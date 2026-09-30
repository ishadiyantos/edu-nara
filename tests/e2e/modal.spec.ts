import { expect, test } from '@playwright/test';

test('modal keeps keyboard focus inside and restores opener after Escape', async ({ page }) => {
	await page.goto('/design', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: 'Design Kitchen Sink' })).toBeVisible();
	const opener = page.getByRole('button', { name: 'Open modal', exact: true });
	const modal = page.getByRole('dialog', { name: 'Confirmation', exact: true });
	await opener.click();
	await expect(modal).toBeVisible();

	const close = modal.getByRole('button', { name: 'Close', exact: true });
	const confirm = modal.getByRole('button', { name: 'Confirm', exact: true });
	await confirm.focus();
	await page.keyboard.press('Tab');
	// Native dialogs allow browser chrome in the tab order, never background page controls.
	if (!(await page.evaluate(() => document.hasFocus()))) await page.keyboard.press('Tab');
	await expect(close).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	if (!(await page.evaluate(() => document.hasFocus()))) await page.keyboard.press('Shift+Tab');
	await expect(confirm).toBeFocused();

	await page.keyboard.press('Escape');
	await expect(modal).toBeHidden();
	await expect(opener).toBeFocused();
	await opener.click();
	await expect(modal).toBeVisible();
	await close.click();
	await expect(modal).toBeHidden();
	await expect(opener).toBeFocused();

	await opener.click();
	await expect(modal).toBeVisible();
	const closeBounds = await close.boundingBox();
	expect(closeBounds?.width).toBeGreaterThanOrEqual(44);
	expect(closeBounds?.height).toBeGreaterThanOrEqual(44);
	await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(modal).toBeHidden();
	await expect(opener).toBeFocused();
});
