import { expect, test } from '@playwright/test';

test('new card modal picks destination column and saves a pastel color', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto('/mock/play/board');

	await page.getByRole('button', { name: 'Tambah kartu ke kolom 👍 Pro' }).click();
	const dialog = page.getByRole('dialog', { name: 'Tulis kartu baru' });
	await expect(dialog).toBeVisible();

	const destination = dialog.getByLabel('Letakkan di kolom');
	await expect(destination).toBeVisible();
	await destination.selectOption({ label: '❓ Pertanyaan' });
	await dialog.getByRole('button', { name: 'Merah muda' }).click();
	await expect(dialog.getByRole('button', { name: 'Merah muda' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await dialog.getByRole('textbox', { name: 'Isi kartu' }).fill('Kartu warna di kolom tujuan');
	await dialog.getByRole('button', { name: 'Kirim' }).click();
	await expect(dialog).not.toBeVisible();

	const questionColumn = page.locator('section').filter({ hasText: '❓ Pertanyaan' }).first();
	const card = questionColumn.locator('article').filter({ hasText: 'Kartu warna di kolom tujuan' });
	await expect(card).toBeVisible();
	await expect(card).toHaveClass(/color-rose/);
	await expect(card).toHaveCSS('background-color', 'rgb(255, 228, 230)');

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth
	);
	expect(overflow).toBe(false);
});
