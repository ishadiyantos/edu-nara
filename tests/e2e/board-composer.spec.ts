import { expect, test } from '@playwright/test';

test('new card modal picks destination column and saves a pastel color', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto('/mock/play/board');

	await page.getByRole('button', { name: 'Add card to column 👍 Pro' }).click();
	const dialog = page.getByRole('dialog', { name: 'Write a new card' });
	await expect(dialog).toBeVisible();

	const destination = dialog.getByLabel('Choose a column');
	await expect(destination).toBeVisible();
	await destination.selectOption({ label: '❓ Questions' });
	await dialog.getByRole('button', { name: 'Rose' }).click();
	await expect(dialog.getByRole('button', { name: 'Rose' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await dialog.getByRole('textbox', { name: 'Card content' }).fill('Kartu warna di kolom tujuan');
	await dialog.getByRole('button', { name: 'Submit' }).click();
	await expect(dialog).not.toBeVisible();

	const questionColumn = page.locator('section').filter({ hasText: '❓ Questions' }).first();
	const card = questionColumn.locator('article').filter({ hasText: 'Kartu warna di kolom tujuan' });
	await expect(card).toBeVisible();
	await expect(card).toHaveClass(/color-rose/);
	await expect(card).toHaveCSS('background-color', 'rgb(255, 228, 230)');

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth
	);
	expect(overflow).toBe(false);
});
