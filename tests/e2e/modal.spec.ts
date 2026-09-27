import { expect, test } from '@playwright/test';

test('modal keeps keyboard focus inside and restores opener after Escape', async ({ page }) => {
	await page.goto('/design', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: 'Design Kitchen Sink' })).toBeVisible();
	const opener = page.getByRole('button', { name: 'Buka Modal', exact: true });
	const modal = page.getByRole('dialog', { name: 'Konfirmasi', exact: true });
	await opener.click();
	await expect(modal).toBeVisible();

	const close = modal.getByRole('button', { name: 'Tutup', exact: true });
	const confirm = modal.getByRole('button', { name: 'Konfirmasi', exact: true });
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
	await modal.getByRole('button', { name: 'Batal', exact: true }).click();
	await expect(modal).toBeHidden();
	await expect(opener).toBeFocused();
});
