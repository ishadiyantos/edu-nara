import { expect, test } from '@playwright/test';

test('production Board: columns, private media, moderation toggle, live updates and presentation', async ({
	page,
	browser
}, testInfo) => {
	test.setTimeout(90000);
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Kata sandi').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	const title = `Board live ${Date.now()}`;
	await page.getByLabel('Judul aktivitas').fill(title);
	await page.getByLabel('Jenis aktivitas').selectOption('board');
	await page.getByRole('button', { name: 'Buat aktivitas', exact: false }).last().click();
	await page
		.locator('article')
		.filter({ hasText: title })
		.getByRole('link', { name: 'Buka editor' })
		.click();
	for (const name of ['Ide', 'Refleksi']) {
		await page.getByLabel('Nama kolom baru').fill(name);
		await page.getByRole('button', { name: 'Tambah kolom', exact: true }).click();
		await expect(page.getByRole('status')).toHaveText('Papan tersimpan.');
	}
	await page.getByRole('button', { name: 'Pindahkan Refleksi ke kiri' }).click();
	await expect(page.getByLabel('Nama kolom 1', { exact: true })).toHaveValue('Refleksi');
	await page.getByRole('button', { name: 'Pindahkan Refleksi ke kanan' }).click();
	await expect(page.getByLabel('Nama kolom 1', { exact: true })).toHaveValue('Ide');
	const popup = page.context().waitForEvent('page');
	await page.getByRole('button', { name: 'Luncurkan sesi Board', exact: true }).click();
	const presenter = await popup;
	await presenter.waitForLoadState();
	const code = (await presenter.getByTestId('session-code').textContent())!.trim();
	const sessionId = presenter.url().split('/').pop()!;
	await presenter.getByRole('button', { name: 'Buka sesi', exact: true }).click();
	await expect(presenter.getByTestId('board-view')).toBeVisible();
	const authorContext = await browser.newContext({ viewport: { width: 360, height: 780 } });
	const observerContext = await browser.newContext({ viewport: { width: 360, height: 780 } });
	try {
		const author = await authorContext.newPage();
		const observer = await observerContext.newPage();
		for (const [student, name] of [
			[author, 'Ana'],
			[observer, 'Bela']
		] as const) {
			await student.goto(`/join?code=${code}`);
			await student.getByLabel('Nama tampilan').fill(name);
			await student.getByRole('button', { name: 'Bergabung', exact: true }).click();
			await expect(student.getByTestId('board-view')).toBeVisible();
		}
		await author.getByRole('button', { name: 'Tambah kartu ke kolom Ide' }).click();
		await author.getByLabel('Judul (opsional)').fill('Gagasan privat');
		await author.getByLabel('Isi kartu', { exact: true }).fill('Belajar bersama dari foto');
		await author.getByLabel('Tautan http/https (opsional)').fill('https://example.com/kelas');
		await author.getByLabel('Gambar (opsional, maksimal 5 MB)').setInputFiles({
			name: 'photo.png',
			mimeType: 'image/png',
			buffer: Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAe0lEQVR4nO3PQQ0AIBDAsFPHF/8C8IEIHg3JkgnoZq/zdcMFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjx2ATb0oVosXmJbAAAAAElFTkSuQmCC',
				'base64'
			)
		});
		await author.getByRole('button', { name: 'Kirim', exact: true }).click();
		const ownCard = author.locator('article').filter({ hasText: 'Gagasan privat' });
		await expect(ownCard).toContainText('Menunggu moderasi');
		await expect
			.poll(() => ownCard.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
			.toBe(64);
		const imageUrl = (await ownCard.locator('img').getAttribute('src'))!;
		expect((await observer.request.get(imageUrl)).status()).toBe(404);
		expect((await author.request.get(imageUrl)).status()).toBe(200);
		await expect(observer.getByText('Gagasan privat', { exact: true })).toHaveCount(0);
		const adminCard = presenter.locator('article').filter({ hasText: 'Gagasan privat' });
		await expect(adminCard).toBeVisible();
		await adminCard.getByRole('button', { name: 'Setujui', exact: true }).click();
		await expect(observer.getByText('Gagasan privat', { exact: true })).toBeVisible();
		expect((await observer.request.get(imageUrl)).status()).toBe(200);
		await adminCard.getByRole('button', { name: 'Tolak', exact: true }).click();
		await expect(observer.getByText('Gagasan privat', { exact: true })).toHaveCount(0);
		await expect(ownCard).toContainText('Ditolak');
		expect((await observer.request.get(imageUrl)).status()).toBe(404);
		const chunk = await observer.evaluate(async (id) => {
			const controller = new AbortController();
			const res = await fetch(`/api/sessions/${id}/events`, {
				signal: controller.signal,
				headers: { 'Last-Event-ID': 'old:0' }
			});
			const first = await res.body!.getReader().read();
			controller.abort();
			return new TextDecoder().decode(first.value);
		}, sessionId);
		expect(chunk).not.toContain('Gagasan privat');
		expect(chunk).not.toContain(imageUrl);
		await presenter.getByRole('button', { name: 'Nonaktifkan moderasi', exact: true }).click();
		await expect(
			presenter.getByRole('button', { name: 'Aktifkan moderasi', exact: true })
		).toBeVisible();
		await author.getByRole('button', { name: 'Tambah kartu ke kolom Ide' }).click();
		await author.getByLabel('Isi kartu', { exact: true }).fill('Langsung tampil');
		await author.getByRole('button', { name: 'Kirim', exact: true }).click();
		await expect(observer.getByText('Langsung tampil', { exact: true })).toBeVisible();
		await observer.reload();
		await expect(observer.getByText('Langsung tampil', { exact: true })).toBeVisible();
		await author.getByRole('button', { name: 'Tambah kartu ke kolom Ide' }).click();
		await author.getByLabel('Isi kartu', { exact: true }).fill('Kartu kedua');
		await author.getByRole('button', { name: 'Kirim', exact: true }).click();
		await expect(presenter.getByText('Kartu kedua', { exact: true })).toBeVisible();
		await presenter.getByRole('button', { name: 'Edit judul Refleksi', exact: true }).click();
		await presenter.getByLabel('Edit judul Refleksi', { exact: true }).fill('Refleksi baru');
		await presenter.getByRole('button', { name: 'Simpan', exact: true }).click();
		await expect(
			presenter.getByRole('heading', { name: 'Refleksi baru', exact: true })
		).toBeVisible();
		await presenter.getByLabel('Judul kolom baru', { exact: true }).fill('Diskusi');
		await presenter.getByRole('button', { name: '+ Tambah kolom', exact: true }).click();
		await expect(presenter.getByRole('heading', { name: 'Diskusi', exact: true })).toBeVisible();
		await presenter
			.locator('article')
			.filter({ hasText: 'Kartu kedua' })
			.getByLabel('Pindahkan kartu Kartu kedua ke kolom', { exact: true })
			.selectOption({ label: 'Refleksi baru' });
		await expect(
			presenter
				.locator('section[aria-label="Refleksi baru"]')
				.getByText('Kartu kedua', { exact: true })
		).toBeVisible();
		await observer.getByLabel('Cari kartu', { exact: true }).fill('tidak cocok');
		await expect(observer.getByText('Langsung tampil', { exact: true })).toHaveCount(0);
		await observer.getByLabel('Cari kartu', { exact: true }).fill('');
		expect(await observer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await presenter.getByTestId('fullscreen-button').click();
		await expect(presenter.getByTestId('session-screen')).toHaveClass(/presentation/);
		await expect(presenter.getByText('Gagasan privat', { exact: true })).toHaveCount(0);
		await expect(
			presenter.getByRole('button', { name: 'Bagikan papan', exact: true })
		).toBeVisible();
		await presenter.getByRole('button', { name: 'Slideshow', exact: true }).click();
		await expect(presenter.getByTestId('board-slideshow')).toContainText('Langsung tampil');
		await presenter.getByRole('button', { name: 'Kartu berikutnya →', exact: true }).click();
		await expect(presenter.getByTestId('board-slideshow')).toContainText('Kartu kedua');
		await observer.screenshot({
			path: `test-results/board-${testInfo.project.name}-student.png`,
			fullPage: true
		});
		await presenter.screenshot({
			path: `test-results/board-${testInfo.project.name}-presenter.png`,
			fullPage: true
		});
		await presenter.keyboard.press('Escape');
		await expect(presenter.getByTestId('session-screen')).not.toHaveClass(/presentation/);
	} finally {
		await authorContext.close();
		await observerContext.close();
	}
});
