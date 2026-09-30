import { expect, test } from '@playwright/test';

test('replacing a middle character keeps the rest of the session code', async ({ page }) => {
	await page.goto('/');
	const cells = page.getByLabel(/Character \d+ of 6/i);
	await cells.first().click();
	await page.keyboard.type('ABC7XK');
	await expect(cells.nth(5)).toHaveValue('K');
	await cells.nth(2).fill('');
	await expect(cells.nth(2)).toHaveValue('');
	await expect(cells.nth(3)).toHaveValue('7');
	await expect(cells.nth(5)).toHaveValue('K');
	await cells.nth(2).fill('D');
	await expect(cells.nth(2)).toHaveValue('D');
	await expect(cells.nth(3)).toHaveValue('7');
	await expect(cells.nth(5)).toHaveValue('K');
});
