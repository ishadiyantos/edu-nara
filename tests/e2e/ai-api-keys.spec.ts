import { expect, test } from '@playwright/test';

test('owner creates scoped key; local agent creates draft idempotently; revoke blocks it', async ({
	page,
	request
}) => {
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Password').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/?$/);
	await page.goto('/admin/ai-keys');
	await expect(page.getByRole('heading', { name: 'AI API keys' })).toBeVisible();
	await page.getByLabel('Key label').fill('E2E local agent');
	await page.getByRole('button', { name: 'Create key' }).click();
	const token = (await page.locator('.secret code').textContent())?.trim();
	expect(token).toMatch(/^eduai_[A-Za-z0-9_-]{43}$/);
	const headers = { authorization: `Bearer ${token}`, 'idempotency-key': 'e2e-board-001' };
	const payload = { title: 'E2E AI Board', columns: ['Facts', 'Diagnosis', 'Actions'] };
	const first = await request.post('/api/v1/admin/activities', { headers, data: payload });
	const created = await first.json();
	expect(first.status(), JSON.stringify(created)).toBe(201);
	expect(created.activity).toMatchObject({ title: 'E2E AI Board', type: 'board' });
	expect(created.launched).toBe(false);
	const retry = await request.post('/api/v1/admin/activities', { headers, data: payload });
	expect(retry.status()).toBe(201);
	expect((await retry.json()).activity.id).toBe(created.activity.id);
	const oversized = await request.post('/api/v1/admin/activities', {
		headers: {
			...headers,
			'idempotency-key': 'e2e-too-large',
			'content-type': 'application/json'
		},
		data: 'x'.repeat(17000)
	});
	expect(oversized.status()).toBe(413);
	const row = page.getByRole('listitem').filter({ hasText: 'E2E local agent' });
	await row.getByRole('button', { name: 'Revoke' }).click();
	const rejected = await request.post('/api/v1/admin/activities', {
		headers: { ...headers, 'idempotency-key': 'e2e-board-002' },
		data: payload
	});
	expect(rejected.status()).toBe(401);
	const missingOrigin = await request.post('/api/admin/ai-keys', {
		data: { label: 'should not pass', expiresInDays: 30 }
	});
	expect(missingOrigin.status()).toBe(403);
});
