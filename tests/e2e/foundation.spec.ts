import { test, expect } from '@playwright/test';
test('admin auth, activity, two guests, rejoin, live lifecycle and access isolation', async ({
	page,
	browser
}) => {
	await page.goto('/admin');
	await expect(page).toHaveURL(/admin\/login/);
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Password').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	await expect(page).toHaveURL(/\/admin$/);
	await page.getByRole('button', { name: 'Create Quiz' }).click();
	const dialog = page.getByRole('dialog', { name: 'Create activity' });
	await dialog.getByLabel('Starting point').selectOption({ label: 'Check understanding' });
	const title = `Kelas pengujian ${Date.now()}`;
	await dialog.getByLabel('Activity title').fill(title);
	await dialog.getByRole('button', { name: 'Create activity', exact: true }).click();
	await expect(page).toHaveURL(/admin\/activities\//);
	await page.getByRole('link', { name: '← Back to workspace' }).click();
	const card = page.getByTestId('activity-card').filter({ hasText: title });
	await expect(card).toBeVisible();
	const popupPromise = page.context().waitForEvent('page');
	await card.getByRole('button', { name: 'Launch session' }).click();
	const presenter = await popupPromise;
	await presenter.waitForLoadState();
	await expect(presenter).toHaveURL(/admin\/sessions\//);
	await presenter.bringToFront();
	page = presenter;
	const code = (await page.getByTestId('session-code').textContent())!.trim();
	const id = page.url().split('/').pop()!;
	await page.getByRole('button', { name: 'Open session', exact: true }).click();
	await page.keyboard.press('Escape');
	const one = await browser.newContext(),
		two = await browser.newContext();
	try {
		const guest = await one.newPage(),
			guest2 = await two.newPage();
		for (const p of [guest, guest2]) {
			await p.goto(`/join?code=${code}`);
			await p.getByLabel('Display name').fill('Peserta');
			await p.getByRole('button', { name: 'Join session' }).click();
			await expect(p.getByTestId('choice-player')).toBeVisible();
			await expect(p.getByTestId('connection')).toHaveText(/Connected|Connecting…/);
		}
		await expect(page.getByTestId('participant-count')).toHaveText('2');
		await guest.reload();
		await expect(guest.getByTestId('choice-player')).toBeVisible();
		await expect(guest.getByTestId('connection')).toHaveText(/Connected|Connecting…/);
		await guest.goto(`/join?code=${code}`);
		await guest.getByLabel('Display name').fill('Peserta');
		await guest.getByRole('button', { name: 'Join session' }).click();
		await expect(page.getByTestId('participant-count')).toHaveText('2');
		expect((await one.request.get('/admin', { maxRedirects: 0 })).status()).toBe(303);
		expect(
			await browser.newContext().then(async (c) => {
				const r = await c.request.get(`/api/sessions/${id}/events`);
				await c.close();
				return r.status();
			})
		).toBe(401);
		await page.getByRole('button', { name: 'Close session' }).click();
		await expect(guest.getByTestId('session-state')).toHaveText('Session closed');
		await page.getByRole('button', { name: 'End session' }).click();
		await expect(guest2.getByTestId('session-state')).toHaveText('Session ended');
		await page.getByRole('link', { name: 'Admin dashboard', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'My Activities' })).toBeVisible();
		const menu = page.getByRole('button', { name: 'Open navigation' });
		if (await menu.isVisible()) await menu.click();
		await page.getByRole('button', { name: 'Log out', exact: true }).click();
		await expect(page).toHaveURL(/admin\/login/);
		expect((await page.request.get(`/admin/sessions/${id}`, { maxRedirects: 0 })).status()).toBe(
			303
		);
	} finally {
		await one.close();
		await two.close();
	}
});
