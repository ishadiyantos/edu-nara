import { test, expect } from '@playwright/test';
test('admin auth, activity, two guests, rejoin, live lifecycle and access isolation', async ({
	page,
	browser
}) => {
	await page.goto('/admin');
	await expect(page).toHaveURL(/admin\/login/);
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Kata sandi').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await expect(page).toHaveURL(/\/admin$/);
	await page.getByLabel('Judul aktivitas').fill('Kelas pengujian');
	await page.getByRole('button', { name: 'Buat aktivitas' }).click();
	await page.getByRole('button', { name: 'Luncurkan sesi' }).last().click();
	await expect(page).toHaveURL(/admin\/sessions\//);
	const code = (await page.getByTestId('session-code').textContent())!.trim();
	const id = page.url().split('/').pop()!;
	await page.getByRole('button', { name: 'Buka sesi', exact: true }).click();
	const one = await browser.newContext(),
		two = await browser.newContext();
	try {
		const guest = await one.newPage(),
			guest2 = await two.newPage();
		for (const p of [guest, guest2]) {
			await p.goto(`/join?code=${code}`);
			await p.getByLabel('Nama tampilan').fill('Peserta');
			await p.getByRole('button', { name: 'Bergabung' }).click();
			await expect(p.getByTestId('connection')).toHaveText('Terhubung');
		}
		await expect(page.getByTestId('participant-count')).toHaveText('2');
		await guest.reload();
		await expect(guest.getByTestId('connection')).toHaveText('Terhubung');
		await guest.goto(`/join?code=${code}`);
		await guest.getByLabel('Nama tampilan').fill('Peserta');
		await guest.getByRole('button', { name: 'Bergabung' }).click();
		await expect(page.getByTestId('participant-count')).toHaveText('2');
		expect((await one.request.get('/admin', { maxRedirects: 0 })).status()).toBe(303);
		expect(
			await browser.newContext().then(async (c) => {
				const r = await c.request.get(`/api/sessions/${id}/events`);
				await c.close();
				return r.status();
			})
		).toBe(401);
		await page.getByRole('button', { name: 'Tutup sesi' }).click();
		await expect(guest.getByTestId('session-state')).toHaveText('Sesi ditutup');
		await page.getByRole('button', { name: 'Akhiri sesi' }).click();
		await expect(guest2.getByTestId('session-state')).toHaveText('Sesi selesai');
		await page.getByRole('button', { name: 'Keluar', exact: true }).click();
		await expect(page).toHaveURL(/admin\/login/);
		expect((await page.request.get(`/admin/sessions/${id}`, { maxRedirects: 0 })).status()).toBe(
			303
		);
	} finally {
		await one.close();
		await two.close();
	}
});
