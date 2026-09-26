import { expect, test } from '@playwright/test';

test.describe('Fase 0 — navigasi wireframe', () => {
	test('alur mahasiswa: landing → join → waiting room', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: /edu nara/i })).toBeVisible();

		// Fill 6 karakter di CodeInput
		const cells = page.getByLabel(/karakter \d+ dari 6/i);
		await expect(cells).toHaveCount(6);
		await cells.first().click();
		for (const ch of 'ABC7XK') {
			await page.keyboard.type(ch);
		}
		await page.getByRole('button', { name: /^masuk$/i }).click();

		await expect(page).toHaveURL(/\/join\?code=ABC7XK/);
		await page.getByLabel(/nama tampilan/i).fill('Isha D.');
		await page.getByRole('button', { name: /bergabung/i }).click();

		await expect(page).toHaveURL(/\/play\/ABC7XK/);
		await expect(page.getByText(/menunggu dosen/i)).toBeVisible();
	});

	test('landing menolak kode < 6 karakter', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /^masuk$/i }).click();
		await expect(page.getByRole('alert')).toContainText(/6 karakter/i);
	});

	test('join menolak nama < 2 karakter', async ({ page }) => {
		await page.goto('/join?code=TEST99');
		await page.getByLabel(/nama tampilan/i).fill('A');
		await page.getByRole('button', { name: /bergabung/i }).click();
		await expect(page.getByRole('alert')).toContainText(/minimal 2/i);
	});

	test('admin dashboard menampilkan daftar aktivitas', async ({ page }) => {
		await page.goto('/admin');
		await expect(page.getByRole('heading', { name: 'Aktivitas' })).toBeVisible();
		// minimal ada 1 kartu aktivitas
		await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
	});

	test('admin login → dashboard', async ({ page }) => {
		await page.goto('/admin/login');
		await page.getByLabel('Email').fill('admin@example.com');
		await page.getByLabel(/kata sandi/i).fill('secret');
		await page.getByRole('button', { name: /^masuk$/i }).click();
		await expect(page).toHaveURL(/\/admin$/);
	});

	test('semua tombol di landing memenuhi target sentuh 44 px', async ({ page }) => {
		await page.goto('/');
		const buttons = await page.getByRole('button').all();
		for (const btn of buttons) {
			const box = await btn.boundingBox();
			if (box) expect(box.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('4 wireframe player screens dapat dibuka', async ({ page }) => {
		for (const path of [
			'/mock/play/choice',
			'/mock/play/wordcloud',
			'/mock/play/board',
			'/mock/play/crossword'
		]) {
			await page.goto(path);
			await expect(page.locator('main')).toBeVisible();
		}
	});

	test('presenter mock menampilkan bar chart & word cloud', async ({ page }) => {
		await page.goto('/mock/presenter/choice');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await page.goto('/mock/presenter/wordcloud');
		await expect(page.getByRole('list', { name: /word cloud/i })).toBeVisible();
	});

	test('design kitchen-sink render tanpa error', async ({ page }) => {
		await page.goto('/design');
		await expect(page.getByRole('heading', { name: /kitchen sink/i })).toBeVisible();
	});
});
