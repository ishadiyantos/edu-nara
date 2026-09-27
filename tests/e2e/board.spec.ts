import { expect, test } from '@playwright/test';

test('board public view renders approved posts, safe links, composer limit, and no mobile overflow', async ({
	page
}) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto('/mock/play/board');

	await expect(page.getByTestId('board-view')).toBeVisible();
	await expect(page.getByText('Cepat dan ringan untuk dipelajari.')).toBeVisible();
	await expect(page.getByText('Cocok untuk SSR?')).toHaveCount(0);

	const safeLink = page.getByRole('link', { name: 'https://developer.mozilla.org' });
	await expect(safeLink).toHaveAttribute('href', 'https://developer.mozilla.org');
	await expect(safeLink).toHaveAttribute('rel', 'noopener noreferrer');

	await page
		.getByRole('button', { name: /Tambah kartu ke kolom/ })
		.first()
		.click();
	const composer = page.getByTestId('post-composer');
	await expect(composer).toBeVisible();
	await composer.getByRole('textbox', { name: 'Tulis Kartu Baru' }).fill('x'.repeat(501));
	await expect(composer.getByTestId('char-counter')).toContainText('501 / 500');
	await expect(composer.getByRole('button', { name: 'Kirim' })).toBeDisabled();

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth
	);
	expect(overflow).toBe(false);
});

test('board shows empty state clearly', async ({ page }) => {
	await page.goto('/mock/play/board');
	await expect(page.getByText('Belum ada kartu tampil di kolom ini.')).toBeVisible();
});

// admin component route comes with backend integration task; test pure UX via module unit suite here.
