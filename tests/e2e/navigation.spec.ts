import { expect, test } from '@playwright/test';
test('landing rejects incomplete code and exposes no pretend scanner', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Join', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('6 characters');
	await expect(page.getByRole('button', { name: 'QR scanner not available yet' })).toBeDisabled();
});
test('landing stays within one screen on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto('/');
	await expect(page.getByTestId('join-shell')).toBeVisible();
	await expect(page.getByTestId('game-show-landing')).toBeVisible();
	await expect(
		page.evaluate(() => document.documentElement.scrollHeight)
	).resolves.toBeLessThanOrEqual(780);
	await expect(page.getByText('Enter your teacher’s session code')).toBeVisible();
	const card = page.getByTestId('activity-preview');
	const cardBox = await card.boundingBox();
	expect(cardBox!.x).toBeGreaterThanOrEqual(16);
	expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(376);
});

test('landing join card stays centered at narrow width', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 780 });
	await page.goto('/');
	const card = page.getByTestId('activity-preview');
	await expect(card).toBeVisible();
	const box = await card.boundingBox();
	expect(box!.x).toBeGreaterThanOrEqual(12);
	expect(box!.x + box!.width).toBeLessThanOrEqual(308);
});
test('join validates short name', async ({ page }) => {
	await page.goto('/join?code=TEST99');
	await page.getByLabel('Display name').fill('A');
	await page.getByRole('button', { name: 'Join session' }).click();
	await expect(page.getByRole('alert')).toContainText('at least 2 characters');
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
			page.getByText('DEMO — sample data, not saved or connected to a real class.')
		).toBeVisible();
	}
});
test('mock presenter charts remain accessible', async ({ page }) => {
	await page.goto('/mock/presenter/choice');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.goto('/mock/presenter/wordcloud');
	await expect(page.getByRole('list', { name: /word cloud/i })).toBeVisible();
});
test('landing has a clear learning hero and join path', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('landing-hero')).toBeVisible();
	await expect(page.getByRole('heading', { name: /Join your class/i })).toBeVisible();
	await expect(page.getByTestId('activity-preview')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeVisible();
});

test('admin workspace has an activity library and quick start', async ({ page }) => {
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Password').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	await expect(page.getByTestId('admin-workspace')).toBeVisible();
	await expect(page.getByTestId('activity-library')).toBeVisible();
	await expect(page.getByRole('heading', { name: /My Activities/i })).toBeVisible();
});

test('activity type filters remain reachable on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Password').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	const library = page.getByTestId('activity-library');
	await expect(library).toBeVisible();
	const typeFilter = library.getByLabel('Activity type');
	await expect(typeFilter).toBeVisible();
	await expect(typeFilter).toContainText('All types');
	await expect(library.getByLabel('Sort by')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Quiz' })).toBeVisible();
});
