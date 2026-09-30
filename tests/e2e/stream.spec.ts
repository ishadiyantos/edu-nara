import { expect, test } from '@playwright/test';
test('authorized stream sends aggregate snapshot, resumes cursor, resyncs invalid cursor and heartbeats', async ({
	page
}) => {
	test.setTimeout(45000);
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Password').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	await page.getByRole('button', { name: 'Create Quiz' }).click();
	const dialog = page.getByRole('dialog', { name: 'Create activity' });
	await dialog.getByLabel('Activity title').fill(`Stream ${Date.now()}`);
	await dialog.getByRole('button', { name: 'Create activity', exact: true }).click();
	await expect(page).toHaveURL(/admin\/activities\//);
	await page.getByRole('link', { name: '← Back to workspace' }).click();
	const popupPromise = page.context().waitForEvent('page');
	await page.getByRole('button', { name: 'Launch session' }).first().click();
	const presenter = await popupPromise;
	await presenter.waitForLoadState();
	await presenter.bringToFront();
	page = presenter;
	const id = page.url().split('/').pop()!;
	const frames = await page.evaluate(async (id) => {
		const read = async (last?: string, heartbeat = false) => {
			const abort = new AbortController();
			const timeout = setTimeout(() => abort.abort(), 25000);
			try {
				const response = await fetch(`/api/sessions/${id}/events`, {
					headers: last ? { 'Last-Event-ID': last } : {},
					signal: abort.signal
				});
				const reader = response.body!.getReader();
				let text = '';
				while (!text.includes(heartbeat ? 'event: heartbeat' : '\n\n')) {
					const part = await reader.read();
					if (part.done) break;
					text += new TextDecoder().decode(part.value);
				}
				await reader.cancel();
				return text;
			} finally {
				clearTimeout(timeout);
				abort.abort();
			}
		};
		const first = await read();
		const cursor = first.match(/id: (.+)/)![1];
		await fetch(`/admin/sessions/${id}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'state=open'
		});
		const replay = await read(cursor),
			resync = await read('invalid:999999'),
			heartbeat = await read(undefined, true);
		return { first, replay, resync, heartbeat };
	}, id);
	expect(frames.first).toContain('event: snapshot');
	expect(frames.replay).toContain('event: session.state');
	expect(frames.resync).toContain('event: resync');
	expect(frames.heartbeat).toContain('event: heartbeat');
	for (const text of Object.values(frames))
		expect(text).not.toMatch(/password|token|displayName|email/);
});
