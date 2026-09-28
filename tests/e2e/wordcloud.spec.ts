import { expect, test } from '@playwright/test';

test('word cloud edit, submit, moderate, reconnect, native fullscreen and fallback', async ({
	page,
	browser
}) => {
	test.setTimeout(60000);
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Kata sandi').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await page.getByLabel('Judul aktivitas').fill(`Cloud flow ${Date.now()}`);
	await page.getByLabel('Jenis aktivitas').selectOption('wordcloud');
	await page.getByRole('button', { name: 'Buat aktivitas' }).click();
	await page.getByRole('link', { name: 'Buka editor' }).first().click();
	await page.getByTestId('wordcloud-add-question').click();
	await page.getByLabel('Pertanyaan', { exact: true }).fill('Bagaimana kelas ini?');
	await expect(page.getByLabel('Moderasi sebelum tampil')).toBeChecked();
	await page.getByLabel('Batas kiriman per peserta').selectOption('2');
	await page.getByRole('button', { name: 'Simpan pertanyaan' }).click();
	await expect(page.getByRole('status')).toHaveText('Pertanyaan tersimpan.');
	await page.getByTestId('wordcloud-add-question').click();
	await page.getByLabel('Pertanyaan', { exact: true }).fill('Satu kata untuk dosen?');
	await page.getByRole('button', { name: 'Simpan pertanyaan' }).click();
	await expect(page.getByRole('status')).toHaveText('Pertanyaan tersimpan.');
	await page.reload();
	await expect(page.getByTestId('wordcloud-question-item')).toHaveCount(2);
	const popupPromise = page.context().waitForEvent('page');
	await page.getByRole('button', { name: 'Luncurkan Word Cloud' }).click();
	const presenter = await popupPromise;
	await presenter.waitForLoadState();
	await presenter.bringToFront();
	page = presenter;
	await expect(page.getByTestId('joining-instructions')).toBeVisible();
	await expect(page.getByRole('img', { name: 'QR code sesi' })).toBeVisible();
	await expect(page.getByTestId('presenter-stage')).toHaveCount(0);
	const screen = page.getByTestId('session-screen');
	const bounds = await screen.boundingBox();
	expect.soft(bounds!.x).toBe(0);
	expect.soft(bounds!.width).toBe(await page.evaluate(() => document.documentElement.clientWidth));
	const code = (await page.getByTestId('session-code').textContent())!.trim();
	const sessionId = page.url().split('/').pop()!;
	// Wrap native API, not replace: proves gesture call and native success.
	await page.evaluate(() => {
		const native = HTMLElement.prototype.requestFullscreen;
		HTMLElement.prototype.requestFullscreen = function (...args) {
			document.documentElement.dataset.fullscreenGesture = String(
				navigator.userActivation.isActive
			);
			return native.apply(this, args);
		};
	});
	await page.getByRole('button', { name: 'Buka sesi', exact: true }).click();
	await expect(page.locator('header')).toContainText('open');
	await page.getByTestId('fullscreen-button').click();
	await expect(page.getByTestId('session-screen')).toHaveClass(/presentation/);
	await expect
		.poll(() => page.evaluate(() => document.documentElement.dataset.fullscreenGesture))
		.toBe('true');
	await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
	await expect(page.getByTestId('session-controls')).toHaveCSS('opacity', '0');
	expect.soft(await screen.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
	await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
	const context = await browser.newContext();
	try {
		const student = await context.newPage();
		await student.goto(`/join?code=${code}`);
		await student.getByLabel('Nama tampilan').fill('Cloud participant');
		await student.getByRole('button', { name: 'Bergabung', exact: true }).click();
		await expect(student.getByTestId('wordcloud-player')).toBeVisible();
		await student.getByLabel('Kata atau frasa', { exact: true }).fill('  SÉRU  ');
		await student.getByRole('button', { name: 'Kirim', exact: true }).click();
		await expect(student.getByRole('list', { name: 'Kiriman Anda' })).toContainText('séru');
		await student.reload();
		await expect(student.getByRole('list', { name: 'Kiriman Anda' })).toContainText('séru');
		await expect(student.getByTestId('wordcloud-results')).not.toContainText('séru');
		await expect(page.getByTestId('wordcloud-results')).not.toContainText('séru');
		// Observer participant cannot see other participant's pending text in SSR, JSON or SSE snapshot/replay.
		const observerContext = await browser.newContext();
		try {
			const observer = await observerContext.newPage();
			await observer.goto(`/join?code=${code}`);
			await observer.getByLabel('Nama tampilan').fill('Observer');
			await observer.getByRole('button', { name: 'Bergabung', exact: true }).click();
			await expect(observer.getByTestId('wordcloud-player')).toBeVisible();
			expect(await (await observer.request.get(`/play/${code}`)).text()).not.toContain('séru');
			expect(
				await (await observer.request.get(`/api/wordcloud/${code}/responses`)).text()
			).not.toContain('séru');
			const chunk = await observer.evaluate(async (id) => {
				const controller = new AbortController();
				const response = await fetch(`/api/sessions/${id}/events`, {
					signal: controller.signal,
					headers: { 'Last-Event-ID': 'old:1' }
				});
				const reader = response.body!.getReader();
				const first = await reader.read();
				controller.abort();
				return new TextDecoder().decode(first.value);
			}, sessionId);
			expect(chunk).not.toContain('séru');
			expect(chunk).toContain('resync');
		} finally {
			await observerContext.close();
		}
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('session-controls')).toBeVisible();
		await expect(page.getByTestId('moderation-item')).toContainText('séru');
		await page.getByRole('button', { name: 'Setujui', exact: true }).click();
		await expect(page.getByTestId('wordcloud-results')).toContainText('séru');
		await expect(student.getByTestId('wordcloud-results')).toContainText('séru');
		await student.reload();
		await expect(student.getByTestId('wordcloud-results')).toContainText('séru');
		await page.evaluate(() => {
			HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('test fallback'));
		});
		const viewport = page.viewportSize()!;
		for (const size of [
			{ width: 1920, height: 1080 },
			{ width: 1920, height: 914 },
			{ width: 1366, height: 768 },
			{ width: 360, height: 780 }
		]) {
			await page.setViewportSize(size);
			await page.getByTestId('fullscreen-button').click();
			const layout = await screen.evaluate((el) => {
				const svg = el
					.querySelector('[data-testid="wordcloud-results"] svg')!
					.getBoundingClientRect();
				return {
					scrolls: el.scrollHeight > el.clientHeight,
					top: svg.top,
					bottom: svg.bottom,
					height: svg.height,
					viewport: innerHeight
				};
			});
			expect(layout.scrolls).toBe(false);
			expect(layout.top).toBeGreaterThanOrEqual(0);
			expect(layout.bottom).toBeLessThanOrEqual(layout.viewport);
			expect(layout.height).toBeGreaterThan(100);
			await page.keyboard.press('Escape');
			const bounds = await screen.boundingBox();
			expect(bounds!.x).toBe(0);
			expect(bounds!.width).toBe(await page.evaluate(() => document.documentElement.clientWidth));
		}
		await page.setViewportSize(viewport);
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('session-screen')).not.toHaveClass(/presentation/);
		await page.getByRole('button', { name: 'Tolak', exact: true }).click();
		await expect(student.getByTestId('wordcloud-results')).not.toContainText('séru');
		// Teacher advances to the second question; both screens follow the same active question.
		await page.getByRole('button', { name: 'Soal 2: Satu kata untuk dosen?', exact: true }).click();
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Satu kata untuk dosen?');
		await expect(
			student.getByTestId('wordcloud-player').getByRole('heading', { level: 1 })
		).toContainText('Satu kata untuk dosen?');
		await expect(student.getByTestId('wordcloud-results')).not.toContainText('séru');
		await student.reload();
		await expect(
			student.getByTestId('wordcloud-player').getByRole('heading', { level: 1 })
		).toContainText('Satu kata untuk dosen?');
		// Denied native permission still gives clean viewport slideshow, keyboard/touch exit.
		await page.evaluate(() => {
			HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('denied'));
		});
		await page.getByTestId('fullscreen-button').click();
		await expect(page.getByTestId('session-screen')).toHaveClass(/presentation/);
		await expect(page.getByTestId('session-controls')).toHaveCSS('opacity', '0');
		await page.mouse.move(20, 20);
		await expect(page.getByRole('navigation', { name: 'Kontrol presentasi' })).toHaveCSS(
			'opacity',
			'1'
		);
		await expect(page.getByRole('navigation', { name: 'Kontrol presentasi' })).toHaveCSS(
			'opacity',
			'0'
		);
		await page.keyboard.press('Tab');
		await page.getByTestId('exit-fullscreen').focus();
		await expect(page.getByTestId('exit-fullscreen')).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('session-controls')).toBeVisible();
		await page.getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
		await expect(page.locator('header')).toContainText('ended');
		const firstQuestion = page.getByRole('button', {
			name: 'Soal 1: Bagaimana kelas ini?',
			exact: true
		});
		await expect(firstQuestion).toBeEnabled();
		await firstQuestion.click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bagaimana kelas ini?');
		await page.reload();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bagaimana kelas ini?');
		await page.getByTestId('fullscreen-button').click();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Satu kata untuk dosen?');
		await expect(page.getByRole('button', { name: 'Sebelumnya', exact: true })).toBeEnabled();
		await page.keyboard.press('ArrowLeft');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bagaimana kelas ini?');
		await page.keyboard.press('Escape');
		await expect(page.getByRole('button', { name: 'Buka sesi', exact: true })).toBeDisabled();
		await student.setViewportSize({ width: 360, height: 780 });
		expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	} finally {
		await context.close();
	}
});
