import { expect, test, type Page } from '@playwright/test';

test('production Board: columns, private media, moderation toggle, live updates and presentation', async ({
	page,
	browser
}, testInfo) => {
	test.setTimeout(90000);
	page.setDefaultTimeout(10000);
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
	await expect(
		page.getByRole('button', { name: 'Luncurkan sesi Board', exact: true })
	).toBeEnabled();
	let presenter: Page;
	if (testInfo.project.name === 'mobile-360') {
		await page
			.locator('form')
			.last()
			.evaluate((form) => form.removeAttribute('target'));
		await page.getByRole('button', { name: 'Luncurkan sesi Board', exact: true }).click();
		presenter = page;
		await presenter.waitForLoadState();
	} else {
		const popup = page.waitForEvent('popup');
		await page.getByRole('button', { name: 'Luncurkan sesi Board', exact: true }).click();
		presenter = await popup;
		await presenter.waitForLoadState();
	}
	const code = (await presenter.getByTestId('session-code').textContent())!.trim();
	presenter.setDefaultTimeout(10000);
	const sessionId = presenter.url().split('/').pop()!;
	await presenter.getByRole('button', { name: 'Buka sesi', exact: true }).click();
	await expect(presenter.getByTestId('board-view')).toBeVisible();
	await expect(presenter.locator('.stage-header .board-tools')).toBeVisible();
	await expect(presenter.getByTestId('session-controls')).toHaveCSS('position', 'fixed');
	await expect(presenter.locator('.board-tools')).toHaveCSS('border-top-width', '0px');
	await expect(presenter.locator('.board-tools')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(presenter.getByRole('button', { name: 'Slideshow', exact: true })).toHaveCSS(
		'border-top-width',
		'0px'
	);
	if (testInfo.project.name === 'desktop-1440') {
		const status = (await presenter.locator('.stage-status').boundingBox())!;
		const tools = (await presenter.locator('.board-tools').boundingBox())!;
		expect(Math.abs(status.y + status.height / 2 - tools.y - tools.height / 2)).toBeLessThan(2);
		expect(status.x).toBeGreaterThan(tools.x + tools.width);
	}
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
			await expect(student.getByRole('link', { name: 'Exit session' })).toBeVisible();
			await expect(student.locator('.student-board-status')).toBeVisible();
			await expect(student.locator('.student-board-actions .board-tools')).toBeVisible();
			await expect(student.locator('.board-tools')).toHaveCSS(
				'background-color',
				'rgba(0, 0, 0, 0)'
			);
			await expect(student.getByRole('button', { name: 'Slideshow', exact: true })).toHaveCSS(
				'border-top-width',
				'0px'
			);
			const bounds = (await student.getByTestId('board-view').boundingBox())!;
			expect(bounds.width).toBeGreaterThanOrEqual(330);
		}
		await observer.setViewportSize({ width: 1440, height: 900 });
		expect((await observer.getByTestId('board-view').boundingBox())!.width).toBeGreaterThan(1350);
		await observer.screenshot({
			path: `test-results/board-student-wide-${testInfo.project.name}.png`
		});
		await observer.setViewportSize({ width: 360, height: 780 });
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
		if (testInfo.project.name === 'mobile-360') {
			await expect(presenter.getByRole('button', { name: 'Slideshow', exact: true })).toBeVisible();
			await expect(
				presenter.getByRole('button', { name: 'Bagikan papan', exact: true })
			).toBeVisible();
			await expect(presenter.getByText('Panel dosen · Moderasi nonaktif')).toHaveCount(0);
			await expect(presenter.getByText('Pindahkan ke', { exact: true })).toHaveCount(0);
			const toolbar = presenter.locator('.stage-header .board-tools');
			await expect(toolbar).toHaveCSS('position', 'static');
			expect(
				await presenter.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
			).toBe(true);
			expect(
				await observer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
			).toBe(true);
		}
		await presenter
			.getByRole('button', { name: 'Edit judul Refleksi', exact: true })
			.scrollIntoViewIfNeeded();
		await presenter.getByRole('button', { name: 'Edit judul Refleksi', exact: true }).click();
		await expect(presenter.getByRole('dialog', { name: 'Edit judul kolom' })).toBeVisible();
		await presenter.getByRole('button', { name: 'Batal', exact: true }).click();
		await expect(presenter.getByRole('dialog')).not.toBeVisible();
		await presenter.getByRole('button', { name: 'Edit judul Refleksi', exact: true }).click();
		await presenter.getByRole('dialog').getByRole('textbox').fill('Refleksi baru');
		await presenter.getByRole('button', { name: 'Simpan', exact: true }).click();
		await expect(
			presenter.getByRole('heading', { name: 'Refleksi baru', exact: true })
		).toBeVisible();
		await presenter.getByRole('button', { name: 'Tambah kolom', exact: true }).click();
		await presenter.getByLabel('Judul kolom baru', { exact: true }).fill('Diskusi');
		await presenter
			.getByRole('dialog')
			.getByRole('button', { name: 'Simpan', exact: true })
			.click();
		await expect(presenter.getByRole('heading', { name: 'Diskusi', exact: true })).toBeVisible();
		const prompts = [
			'Apa tantangan terbesar dalam penerapan platform penyuluhan pertanian digital?',
			'Menurut Anda bagaimana platform penyuluhan pertanian digital dapat meningkatkan efektivitas penyuluhan?',
			'Apakah penyuluhan secara digital dapat menggantikan penyuluhan konvensional atau tradisional?'
		];
		for (const [i, original] of ['Ide', 'Refleksi baru', 'Diskusi'].entries()) {
			await presenter.getByRole('button', { name: `Edit judul ${original}`, exact: true }).click();
			await presenter.getByRole('dialog').getByRole('textbox').fill(prompts[i]);
			await presenter
				.getByRole('dialog')
				.getByRole('button', { name: 'Simpan', exact: true })
				.click();
			await expect(presenter.getByRole('dialog')).not.toBeVisible();
		}
		const geometry = await presenter.locator('.column-heading').evaluateAll((heads) =>
			heads.map((h) => ({
				bottom: h.getBoundingClientRect().bottom,
				width: h.getBoundingClientRect().width
			}))
		);
		expect(
			Math.max(...geometry.map((h) => h.bottom)) - Math.min(...geometry.map((h) => h.bottom))
		).toBeLessThan(2);
		if (testInfo.project.name === 'desktop-1440') expect(geometry[0].width).toBeGreaterThan(400);
		const card = presenter.locator('article').filter({ hasText: 'Langsung tampil' });
		expect(
			await card.evaluate(
				(el) =>
					el.querySelector('.card-author')!.getBoundingClientRect().top -
					el.getBoundingClientRect().top
			)
		).toBeLessThan(24);
		await presenter.locator('.columns').evaluate((el) => {
			el.scrollLeft = 0;
		});
		await presenter.screenshot({
			path: `test-results/board-redesign-${testInfo.project.name}.png`,
			fullPage: true
		});
		await presenter.getByTestId('fullscreen-button').click();
		await expect(presenter.getByTestId('session-screen')).toHaveClass(/presentation/);
		await presenter.locator('.column-content').evaluateAll((nodes) =>
			nodes.forEach((el) => {
				el.scrollTop = 0;
			})
		);
		await presenter.screenshot({
			path: `test-results/board-presentation-${testInfo.project.name}.png`
		});
		await presenter.getByRole('button', { name: `Edit judul ${prompts[0]}`, exact: true }).click();
		await expect(presenter.getByRole('dialog')).toBeVisible();
		await presenter.getByRole('button', { name: 'Batal', exact: true }).click();
		await expect(presenter.getByTestId('session-screen')).toHaveClass(/presentation/);
		await presenter.keyboard.press('Escape');
		for (const [i, original] of ['Ide', 'Refleksi baru', 'Diskusi'].entries()) {
			await presenter
				.getByRole('button', { name: `Edit judul ${prompts[i]}`, exact: true })
				.click();
			if (i === 0)
				await presenter.screenshot({
					path: `test-results/board-modal-${testInfo.project.name}.png`
				});
			await presenter.getByRole('dialog').getByRole('textbox').fill(original);
			await presenter
				.getByRole('dialog')
				.getByRole('button', { name: 'Simpan', exact: true })
				.click();
			await expect(presenter.getByRole('dialog')).not.toBeVisible();
		}
		await presenter.evaluate(() => {
			const source = [...document.querySelectorAll('article')].find((node) =>
				node.textContent?.includes('Kartu kedua')
			);
			const target = document.querySelector('section[aria-label="Refleksi baru"]');
			if (!source || !target) throw new Error('Board drag target tidak ditemukan.');
			const transfer = new DataTransfer();
			transfer.effectAllowed = 'move';
			transfer.setData(
				'application/x-edu-nara-board-post',
				source.getAttribute('data-testid')!.replace('board-post-', '')
			);
			transfer.setData(
				'text/plain',
				source.getAttribute('data-testid')!.replace('board-post-', '')
			);
			source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
			target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
			target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }));
			target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
			source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
		});
		await expect(
			presenter
				.locator('section[aria-label="Refleksi baru"]')
				.getByText('Kartu kedua', { exact: true })
		).toBeVisible();
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
		await expect(presenter.locator('.stage-header .board-tools')).toBeVisible();
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
