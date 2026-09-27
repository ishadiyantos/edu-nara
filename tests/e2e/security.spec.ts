import { test, expect, type APIRequestContext } from '@playwright/test';
const origin = 'http://127.0.0.1:4173';
async function login(request: APIRequestContext) {
	const r = await request.post('/admin/login', {
		form: { email: 'phase1@example.test', password: 'phase1-test-only-password-2026' },
		headers: { origin, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(r.status()).toBe(303);
}
test('JSON CSRF, session isolation, cookie flags, rotation, logout and closed joins', async ({
	browser
}) => {
	const admin = await browser.newContext(),
		guest = await browser.newContext(),
		outsider = await browser.newContext();
	try {
		await login(admin.request);
		const first = (await admin.cookies()).find((c) => c.name === 'edu_admin')!;
		expect(first).toMatchObject({ httpOnly: true, sameSite: 'Lax', secure: false });
		await login(admin.request);
		const second = (await admin.cookies()).find((c) => c.name === 'edu_admin')!;
		expect(second.value).not.toBe(first.value);
		await outsider.addCookies([{ ...first }]);
		expect((await outsider.request.get('/admin', { maxRedirects: 0 })).status()).toBe(303);
		await outsider.clearCookies();
		const p = await admin.newPage();
		await p.goto('/admin');
		await p.getByLabel('Judul aktivitas').fill('Isolasi');
		await p.getByRole('button', { name: 'Buat aktivitas' }).click();
		await p.getByRole('button', { name: 'Luncurkan sesi' }).first().click();
		const id = p.url().split('/').pop()!,
			code = (await p.getByTestId('session-code').textContent())!.trim();
		await p.getByRole('button', { name: 'Buka sesi', exact: true }).click();
		await p.keyboard.press('Escape');
		for (const hostile of ['https://evil.invalid', 'null']) {
			expect(
				(
					await guest.request.post('/api/join', {
						data: { code, displayName: 'Hacker' },
						headers: { origin: hostile }
					})
				).status()
			).toBe(403);
			expect(
				(
					await admin.request.post(`/admin/sessions/${id}`, {
						form: { state: 'ended' },
						headers: { origin: hostile }
					})
				).status()
			).toBe(403);
		}
		const join = await guest.request.post('/api/join', {
			data: { code, displayName: 'Peserta' },
			headers: { origin }
		});
		expect(join.status()).toBe(200);
		const result = await join.json();
		expect(result).toMatchObject({ ok: true, sessionId: id });
		expect(JSON.stringify(result)).not.toMatch(/token|displayName/);
		const cookies = await guest.cookies();
		expect(cookies[0]).toMatchObject({ httpOnly: true, sameSite: 'Lax', secure: false });
		expect(
			(
				await guest.request.post('/api/join', {
					data: { code, displayName: 'Peserta' },
					headers: { origin }
				})
			).status()
		).toBe(200);
		expect(
			(
				await guest.request.post(`/admin/sessions/${id}`, {
					form: { state: 'ended' },
					headers: { origin }
				})
			).status()
		).toBe(401);
		const headerCases: Record<string, string>[] = [{}, { 'last-event-id': 'not-real:999' }];
		for (const headers of headerCases)
			expect((await outsider.request.get(`/api/sessions/${id}/events`, { headers })).status()).toBe(
				401
			);
		expect((await guest.request.get('/api/sessions/not-the-session/events')).status()).toBe(401);
		await p.getByRole('button', { name: 'Tutup sesi' }).click();
		expect(
			(
				await outsider.request.post('/api/join', {
					data: { code, displayName: 'Late' },
					headers: { origin }
				})
			).status()
		).toBe(400);
		expect(
			(
				await guest.request.post('/api/join', {
					data: { code, displayName: 'Peserta' },
					headers: { origin }
				})
			).status()
		).toBe(200);
		expect((await admin.request.get('/admin/logout')).status()).toBe(405);
		expect((await admin.request.get('/admin')).status()).toBe(200);
		await admin.request.post('/admin/logout', { headers: { origin }, maxRedirects: 0 });
		await outsider.addCookies([{ ...second }]);
		expect((await outsider.request.get('/admin', { maxRedirects: 0 })).status()).toBe(303);
		const health = await outsider.request.get('/health');
		expect(health.status()).toBe(200);
		expect(health.headers()).toMatchObject({
			'content-security-policy': expect.stringContaining("default-src 'self'"),
			'x-content-type-options': 'nosniff',
			'x-frame-options': 'DENY'
		});
		expect(
			(await outsider.request.post('/api/join', { data: { code, displayName: 'No Origin' } })).status()
		).toBe(403);
		expect(
			(
				await outsider.request.post('/api/join', {
					data: { code, displayName: 'Peserta', unexpected: true },
					headers: { origin }
				})
			).status()
		).toBe(400);
	} finally {
		await admin.close();
		await guest.close();
		await outsider.close();
	}
});
