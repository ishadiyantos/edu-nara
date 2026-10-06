import { expect, test } from '@playwright/test';

test('manual crossword flows from editor to student autosave and server check', async ({
	page,
	context
}) => {
	await page.goto('/admin');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Password').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	await expect(page).toHaveURL(/\/admin$/);

	await page.getByRole('button', { name: 'Create Crossword' }).click();
	const dialog = page.getByRole('dialog', { name: 'Create activity' });
	const title = `Crossword E2E ${Date.now()}`;
	await dialog.getByLabel('Activity title').fill(title);
	await dialog.getByRole('button', { name: 'Create activity', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/activities\/[^/]+\/crossword$/);

	await page.getByLabel('Answer').fill('RICE');
	await page.getByLabel('Clue').fill('Staple crop');
	await page.getByLabel('Row').fill('0');
	await page.getByLabel('Column').fill('0');
	await page.getByLabel('Direction').selectOption('across');
	await page.getByRole('button', { name: /Save entry/ }).click();
	await expect(page.getByText('Staple crop')).toBeVisible();

	await page.getByRole('button', { name: '+ Add clue' }).click();
	await page.getByLabel('Answer').fill('ISLE');
	await page.getByLabel('Clue').fill('Small island');
	await page.getByLabel('Row').fill('0');
	await page.getByLabel('Column').fill('1');
	await page.getByLabel('Direction').selectOption('down');
	await page.getByRole('button', { name: /Save entry/ }).click();
	await expect(page.getByText('Small island')).toBeVisible();

	const popupPromise = context.waitForEvent('page');
	await page.getByRole('button', { name: 'Launch crossword session' }).click();
	const presenter = await popupPromise;
	await presenter.waitForLoadState();
	await expect(presenter).toHaveURL(/\/admin\/sessions\//);
	const code = (await presenter.getByTestId('session-code').textContent())!.trim();
	await presenter.getByRole('button', { name: 'Open session', exact: true }).click();

	const student = await context.newPage();
	await student.goto(`/join?code=${code}`);
	await student.getByLabel('Display name').fill('Crossword Student');
	await student.getByRole('button', { name: 'Join session' }).click();
	await expect(student.getByTestId('crossword-player')).toBeVisible();

	const answers: Record<string, string> = {
		'0,0': 'R',
		'0,1': 'I',
		'0,2': 'C',
		'0,3': 'E',
		'1,1': 'S',
		'2,1': 'L',
		'3,1': 'E'
	};
	for (const [cell, value] of Object.entries(answers)) {
		await student.locator(`[data-cell="${cell}"]`).fill(value);
	}
	await expect(student.getByRole('status')).toContainText('Progress saved.', { timeout: 5000 });
	await student.getByRole('button', { name: 'Check puzzle' }).click();
	await expect(student.getByRole('status')).toContainText('Puzzle complete!', { timeout: 5000 });

	await student.close();
	await presenter.close();
});

// Keep this E2E isolated from shared browser state and leave no admin session behind.
test.afterEach(async ({ page }) => {
	if (await page.getByRole('button', { name: 'Log out', exact: true }).count()) {
		await page.getByRole('button', { name: 'Log out', exact: true }).click();
	}
});

export {};
