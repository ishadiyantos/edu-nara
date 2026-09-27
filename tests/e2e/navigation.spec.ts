import { expect, test } from '@playwright/test';
test('landing rejects incomplete code and exposes no pretend scanner', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('6 karakter');
	await expect(page.getByRole('button', { name: 'Pindai QR belum tersedia' })).toBeDisabled();
});
test('landing tetap satu layar tanpa scroll pada ponsel', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto('/');
	await expect(page.getByTestId('join-shell')).toBeVisible();
	await expect(page.evaluate(() => document.documentElement.scrollHeight)).resolves.toBeLessThanOrEqual(780);
	await expect(page.getByText('Masukkan kode sesi dari dosenmu')).toBeVisible();
});
test('join validates short name', async ({ page }) => {
	await page.goto('/join?code=TEST99');
	await page.getByLabel('Nama tampilan').fill('A');
	await page.getByRole('button', { name: 'Bergabung' }).click();
	await expect(page.getByRole('alert')).toContainText('minimal 2');
});
test('landing touch targets at least44px', async ({ page }) => {
	await page.goto('/');
	for (const button of await page.getByRole('button').all()) {
		const box = await button.boundingBox();
		if (box) expect(box.height).toBeGreaterThanOrEqual(44);
	}
});
test('mock players remain explicitly demos', async ({ page }) => {
	for (const name of ['choice', 'wordcloud', 'board', 'crossword']) {
		await page.goto(`/mock/play/${name}`);
		await expect(page.locator('main')).toBeVisible();
		await expect(
			page.getByText('DEMO Fase 0 — data simulasi, tidak tersimpan dan bukan koneksi kelas nyata.')
		).toBeVisible();
	}
});
test('mock presenter charts remain accessible', async ({ page }) => {
	await page.goto('/mock/presenter/choice');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.goto('/mock/presenter/wordcloud');
	await expect(page.getByRole('list', { name: /word cloud/i })).toBeVisible();
});
test('fase 1.5 landing memiliki hero belajar dan jalur join yang jelas', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('landing-hero')).toBeVisible();
	await expect(page.getByRole('heading', { name: /Masuk ke kelasmu/i })).toBeVisible();
	await expect(page.getByTestId('activity-preview')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
});

test('fase 1.5 admin workspace memiliki library aktivitas dan quick start', async ({ page }) => {
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Kata sandi').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await expect(page.getByTestId('admin-workspace')).toBeVisible();
	await expect(page.getByTestId('activity-library')).toBeVisible();
	await expect(page.getByRole('heading', { name: /Mulai sesi baru/i })).toBeVisible();
});

test('fase 1.5 activity type filters remain reachable on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Kata sandi').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	const filters = page.getByTestId('activity-filter');
	await expect(filters).toBeVisible();
	await expect(filters.getByRole('button', { name: 'Semua' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Quiz' })).toBeVisible();
	const activityMark = page.locator('.activity-mark').first();
	const markBackground = await activityMark.evaluate((el) => getComputedStyle(el).backgroundColor);
	expect(markBackground).not.toBe('rgba(0, 0, 0, 0)');
});
