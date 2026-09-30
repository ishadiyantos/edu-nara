import { test, expect } from '@playwright/test';

test('dashboard creates illustrated activity and supports search, rename, duplicate', async ({
	page
}) => {
	await page.goto('/admin');
	await expect(page).toHaveURL(/admin\/login/);
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Password').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	await expect(page).toHaveURL(/\/admin$/);

	const picker = page.getByTestId('activity-picker');
	await expect(picker.getByRole('button', { name: 'Create Quiz' })).toBeVisible();
	await expect(picker.getByRole('button', { name: 'Create Word Cloud' })).toBeVisible();
	await expect(picker.getByRole('button', { name: 'Create Board' })).toBeVisible();

	await page.getByRole('button', { name: 'Create Quiz' }).click();
	const create = page.getByRole('dialog', { name: 'Create activity' });
	await expect(create).toBeVisible();
	await create.getByLabel('Starting point').selectOption({ label: 'Check understanding' });
	await create.getByLabel('Activity title').fill(`Dashboard smoke ${Date.now()}`);
	await create.getByRole('button', { name: 'Create activity', exact: true }).click();
	// Create redirects into the quiz editor.
	await expect(page).toHaveURL(/admin\/activities\//);
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Build your quiz');

	await page.getByRole('link', { name: '← Back to workspace' }).click();
	const renamed = page.getByTestId('activity-card').filter({ hasText: 'Dashboard smoke' }).first();
	await expect(renamed).toBeVisible();

	await renamed.locator('summary').click();
	await page.getByRole('button', { name: 'Rename', exact: true }).click();
	const rename = page.getByRole('dialog', { name: 'Rename activity' });
	const renamedTitle = `Dashboard renamed ${Date.now()}`;
	await rename.getByLabel('Activity title').fill(renamedTitle);
	await rename.getByRole('button', { name: 'Save title', exact: true }).click();
	await expect(page.getByTestId('activity-card').filter({ hasText: renamedTitle })).toBeVisible();

	const card = page.getByTestId('activity-card').filter({ hasText: renamedTitle }).first();
	await card.locator('summary').click();
	await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
	const duplicate = page.getByRole('dialog', { name: 'Duplicate activity' });
	await duplicate.getByRole('button', { name: 'Duplicate activity', exact: true }).click();
	// Duplicate also redirects into the editor of the copy.
	await expect(page).toHaveURL(/admin\/activities\//);

	await page.getByRole('link', { name: '← Back to workspace' }).click();
	await page.getByPlaceholder('Search by title').fill(`Copy — ${renamedTitle}`);
	await expect(page.getByTestId('library-items').getByTestId('activity-card')).toHaveCount(1);
	await page.getByPlaceholder('Search by title').fill('');
	await page.getByRole('button', { name: 'List', exact: true }).click();
	await expect(page.getByTestId('library-items')).toHaveClass(/list/);
});
