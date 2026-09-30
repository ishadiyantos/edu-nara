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
	await expect(presenter.locator('.board-tools')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	if (testInfo.project.name === 'mobile-360') {
		await expect(presenter.getByLabel('Cari kartu', { exact: true })).not.toBeVisible();
		await presenter.getByRole('button', { name: 'Buka pencarian', exact: true }).click();
		await expect(presenter.getByLabel('Cari kartu', { exact: true })).toBeFocused();
		await presenter.getByRole('button', { name: 'Tutup pencarian', exact: true }).click();
		const dock = presenter.getByTestId('session-controls');
		expect((await dock.boundingBox())!.height).toBeLessThan(52);
		for (const control of await dock.locator('.floating-control').all()) {
			const box = (await control.boundingBox())!;
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.height).toBeGreaterThanOrEqual(44);
		}
		await expect(dock).toHaveCSS('border-top-width', '0px');
		await expect(presenter.getByTestId('session-controls')).toHaveCSS(
			'background-color',
			'rgba(0, 0, 0, 0)'
		);
	}
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
			await expect(student.getByLabel('Cari kartu', { exact: true })).not.toBeVisible();
			await student.getByRole('button', { name: 'Buka pencarian', exact: true }).click();
			await expect(student.getByLabel('Cari kartu', { exact: true })).toBeFocused();
			await student.getByLabel('Cari kartu', { exact: true }).press('Escape');
			await expect(student.getByLabel('Cari kartu', { exact: true })).not.toBeVisible();
			const actions = (await student.locator('.student-board-actions').boundingBox())!;
			expect(actions.height).toBeLessThanOrEqual(72);
			await expect(student.locator('.exit-label')).not.toBeVisible();
			await student.screenshot({
				path: `test-results/board-mobile-compact-${name}-${testInfo.project.name}.png`
			});
			const bounds = (await student.getByTestId('board-view').boundingBox())!;
			expect(bounds.width).toBeGreaterThanOrEqual(330);
			expect(bounds.x).toBeGreaterThanOrEqual(12);
			expect(bounds.x + bounds.width).toBeLessThanOrEqual(348);
		}
		await observer.setViewportSize({ width: 1440, height: 900 });
		expect((await observer.getByTestId('board-view').boundingBox())!.width).toBeGreaterThan(1350);
		await observer.screenshot({
			path: `test-results/board-student-wide-${testInfo.project.name}.png`
		});
		await observer.setViewportSize({ width: 360, height: 780 });
		await author.getByRole('button', { name: 'Tambah kartu ke kolom Ide' }).click();
		await expect(author.getByRole('dialog', { name: 'Tulis kartu baru' })).toBeVisible();
		await expect(author.getByLabel('Letakkan di kolom').locator('option:checked')).toHaveText(
			'Ide'
		);
		await author.getByRole('button', { name: 'Merah muda', exact: true }).click();
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
		await expect(ownCard).toHaveCSS('background-color', 'rgb(255, 228, 230)');
		await author.reload();
		await expect(ownCard).toHaveCSS('background-color', 'rgb(255, 228, 230)');
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
		const columnEnds = await presenter.locator('.column-content').evaluateAll((columns) =>
			columns
				.map((column) => {
					column.scrollTop = column.scrollHeight;
					const last = column.querySelector('.card-slot:last-of-type');
					if (!last) return null;
					const content = column.getBoundingClientRect();
					const card = last.getBoundingClientRect();
					return {
						scrollable: column.scrollHeight > column.clientHeight,
						clearance: content.bottom - card.bottom
					};
				})
				.filter((value): value is { scrollable: boolean; clearance: number } => value !== null)
		);
		for (const column of columnEnds) {
			if (column.scrollable) expect(column.clearance).toBeGreaterThanOrEqual(12);
		}
		if (testInfo.project.name === 'mobile-360') {
			await expect(presenter.getByRole('button', { name: 'Slideshow', exact: true })).toBeVisible();
			await expect(
				presenter.getByRole('button', { name: 'Bagikan papan', exact: true })
			).toBeVisible();
			await expect(presenter.getByText('Panel dosen · Moderasi nonaktif')).toHaveCount(0);
			await expect(presenter.getByText('Pindahkan ke', { exact: true })).toHaveCount(0);
			const toolbar = presenter.locator('.stage-header .board-tools');
			await expect(toolbar).toHaveCSS('position', 'relative');
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
		// Inspect drag feedback and same-column insertion before the cross-column move.
		const dragged = presenter.locator('[data-post-id]').filter({ hasText: 'Kartu kedua' });
		const first = presenter.locator('[data-post-id]').filter({ hasText: 'Langsung tampil' });
		let transfer = await presenter.evaluateHandle(() => new DataTransfer());
		await dragged.dispatchEvent('dragstart', { dataTransfer: transfer });
		await expect(dragged).toHaveClass(/dragging/);
		await expect
			.poll(async () => dragged.evaluate((node) => getComputedStyle(node).filter))
			.toBe('blur(2.5px) saturate(0.7)');
		await expect(presenter.locator('[data-drag-preview]')).toHaveCount(1);
		const firstBox = (await first.boundingBox())!;
		await first.dispatchEvent('dragover', { dataTransfer: transfer, clientY: firstBox.y + 2 });
		await expect(first.locator('..')).toHaveClass(/insert-before/);
		expect(
			await first
				.locator('..')
				.evaluate((node) => getComputedStyle(node, '::before').backgroundImage)
		).toContain('250, 204, 21');
		await presenter.screenshot({ path: `test-results/board-drag-${testInfo.project.name}.png` });
		await presenter.keyboard.press('Escape');
		await expect(presenter.locator('.insert-before, .insert-after')).toHaveCount(0);
		await expect(dragged).not.toHaveClass(/dragging/);
		await expect(presenter.locator('[data-drag-preview]')).toHaveCount(0);
		await dragged.dispatchEvent('dragstart', { dataTransfer: transfer });
		await first.dispatchEvent('drop', { dataTransfer: transfer, clientY: firstBox.y + 2 });
		const ideaCards = presenter.locator('section[aria-label="Ide"] [data-post-id]');
		await expect(ideaCards.nth(1)).toContainText('Kartu kedua');
		await transfer.dispose();
		await presenter.reload();
		transfer = await presenter.evaluateHandle(() => new DataTransfer());
		await expect(ideaCards.nth(1)).toContainText('Kartu kedua');
		// Lower half means AFTER; API index excludes the dragged card.
		const restoredFirstBox = (await first.boundingBox())!;
		if (testInfo.project.name === 'desktop-1440') {
			await first.scrollIntoViewIfNeeded();
			const source = (await dragged.boundingBox())!;
			await presenter.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
			await presenter.mouse.down();
			await presenter.mouse.move(source.x + 20, source.y + 20, { steps: 5 });
			const target = (await first.boundingBox())!;
			await presenter.mouse.move(target.x + target.width / 2, target.y + target.height - 8, {
				steps: 15
			});
			await presenter.mouse.move(target.x + target.width / 2, target.y + target.height - 7);
			await expect(first.locator('..')).toHaveClass(/insert-after/);
			await presenter.screenshot({ path: 'test-results/board-native-drag.png' });
			await presenter.mouse.up();
		} else {
			await dragged.dispatchEvent('dragstart', { dataTransfer: transfer });
			await first.dispatchEvent('dragover', {
				dataTransfer: transfer,
				clientY: restoredFirstBox.y + restoredFirstBox.height - 2
			});
			await expect(first.locator('..')).toHaveClass(/insert-after/);
			await first.dispatchEvent('drop', {
				dataTransfer: transfer,
				clientY: restoredFirstBox.y + restoredFirstBox.height - 2
			});
		}
		await expect(ideaCards.last()).toContainText('Kartu kedua');
		await expect(presenter.getByTestId('board-view')).toHaveAttribute('aria-busy', 'false');
		await transfer.dispose();
		const crossColumnSource = presenter
			.locator('[data-post-id]')
			.filter({ hasText: 'Kartu kedua' });
		const crossColumnTarget = presenter.locator('section[aria-label="Refleksi baru"]');
		const crossColumnTransfer = await presenter.evaluateHandle(() => new DataTransfer());
		await crossColumnSource.dispatchEvent('dragstart', { dataTransfer: crossColumnTransfer });
		const crossTargetBox = (await crossColumnTarget.boundingBox())!;
		await crossColumnTarget.dispatchEvent('dragover', {
			dataTransfer: crossColumnTransfer,
			clientY: crossTargetBox.y + 8
		});
		await expect(crossColumnTarget.locator('.empty')).toHaveClass(/insert-before/);
		const moveResponse = presenter.waitForResponse(
			(response) =>
				response.url().includes('/posts/') &&
				response.url().endsWith('/move') &&
				response.request().method() === 'POST'
		);
		await crossColumnTarget.dispatchEvent('drop', {
			dataTransfer: crossColumnTransfer,
			clientY: crossTargetBox.y + 8
		});
		expect((await moveResponse).ok()).toBe(true);
		await crossColumnSource.dispatchEvent('dragend', { dataTransfer: crossColumnTransfer });
		await expect(
			presenter
				.locator('section[aria-label="Refleksi baru"] [data-post-id]')
				.filter({ hasText: 'Kartu kedua' })
		).toHaveCount(1);
		await crossColumnTransfer.dispose();
		await observer.getByRole('button', { name: 'Buka pencarian', exact: true }).click();
		await observer.getByLabel('Cari kartu', { exact: true }).fill('tidak cocok');
		await expect(observer.getByText('Langsung tampil', { exact: true })).toHaveCount(0);
		await observer.getByRole('button', { name: 'Tutup pencarian', exact: true }).click();
		await expect(observer.getByText('Langsung tampil', { exact: true })).toBeVisible();
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
