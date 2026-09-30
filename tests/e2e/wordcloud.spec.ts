import { expect, test } from '@playwright/test';

test('word cloud edit, submit, moderate, reconnect, native fullscreen and fallback', async ({
	page,
	browser
}) => {
	test.setTimeout(60000);
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Password').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	await page.getByRole('button', { name: 'Create Word Cloud' }).click();
	const dialog = page.getByRole('dialog', { name: 'Create activity' });
	await dialog.getByLabel('Activity title').fill(`Cloud flow ${Date.now()}`);
	await dialog.getByRole('button', { name: 'Create activity', exact: true }).click();
	await expect(page).toHaveURL(/admin\/activities\//);
	await page.getByTestId('wordcloud-add-question').click();
	await page.getByLabel('Question', { exact: true }).fill('Bagaimana kelas ini?');
	await expect(page.getByLabel('Moderate before display')).toBeChecked();
	await page.getByLabel('Submission limit per participant').selectOption('2');
	await page.getByRole('button', { name: 'Save question' }).click();
	await expect(page.getByRole('status')).toHaveText('Question saved.');
	await page.getByTestId('wordcloud-add-question').click();
	await page.getByLabel('Question', { exact: true }).fill('Satu kata untuk dosen?');
	await page.getByRole('button', { name: 'Save question' }).click();
	await expect(page.getByRole('status')).toHaveText('Question saved.');
	await page.reload();
	await expect(page.getByTestId('wordcloud-question-item')).toHaveCount(2);
	const popupPromise = page.context().waitForEvent('page');
	await page.getByRole('button', { name: 'Launch Word Cloud' }).click();
	const presenter = await popupPromise;
	await presenter.waitForLoadState();
	await presenter.bringToFront();
	page = presenter;
	await expect(page.getByTestId('joining-instructions')).toBeVisible();
	await expect(page.getByRole('img', { name: 'Session QR code' })).toBeVisible();
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
	await page.getByRole('button', { name: 'Open session', exact: true }).click();
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
		await student.getByLabel('Display name').fill('Cloud participant');
		await student.getByRole('button', { name: 'Join session', exact: true }).click();
		await expect(student.getByTestId('wordcloud-player')).toBeVisible();
		await student.getByLabel('Word or phrase', { exact: true }).fill('  SÉRU  ');
		await student.getByRole('button', { name: 'Submit', exact: true }).click();
		await expect(student.getByRole('list', { name: 'Your submissions' })).toContainText('séru');
		await student.reload();
		await expect(student.getByRole('list', { name: 'Your submissions' })).toContainText('séru');
		await expect(student.getByTestId('wordcloud-results')).not.toContainText('séru');
		await expect(page.getByTestId('wordcloud-results')).not.toContainText('séru');
		// Observer participant cannot see other participant's pending text in SSR, JSON or SSE snapshot/replay.
		const observerContext = await browser.newContext();
		try {
			const observer = await observerContext.newPage();
			await observer.goto(`/join?code=${code}`);
			await observer.getByLabel('Display name').fill('Observer');
			await observer.getByRole('button', { name: 'Join session', exact: true }).click();
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
		await page.getByRole('button', { name: 'Approve', exact: true }).click();
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
		await page.getByRole('button', { name: 'Reject', exact: true }).click();
		await expect(student.getByTestId('wordcloud-results')).not.toContainText('séru');
		// Teacher advances to the second question; both screens follow the same active question.
		await page.getByRole('button', { name: 'Next', exact: true }).click();
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
		await expect(page.getByTestId('session-controls')).toHaveCSS('opacity', '0.92');
		await expect(page.getByTestId('session-controls')).toHaveCSS('opacity', '0');
		await page.keyboard.press('Tab');
		await page.getByTestId('exit-fullscreen').focus();
		await expect(page.getByTestId('exit-fullscreen')).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('session-controls')).toBeVisible();
		await page.getByRole('button', { name: 'End session', exact: true }).click();
		await expect(page.locator('header')).toContainText('ended');
		await page.getByTestId('fullscreen-button').click();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Satu kata untuk dosen?');
		await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeEnabled();
		await page.keyboard.press('ArrowLeft');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bagaimana kelas ini?');
		await page.keyboard.press('Escape');
		await expect(page.getByRole('button', { name: 'Open session', exact: true })).toBeDisabled();
		await student.setViewportSize({ width: 360, height: 780 });
		expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	} finally {
		await context.close();
	}
});
