import { expect, test, type Page } from '@playwright/test';

type Live = {
	activeQuestionId: string;
	quizMode: string;
	timerDeadline: number | null;
	timerDuration: number;
	serverNow: number;
	question?: { id: string; options: { id: string }[] };
	tally?: unknown;
};
async function readSnapshot(page: Page, sessionId: string): Promise<Live> {
	return page.evaluate(
		(id) =>
			new Promise((resolve, reject) => {
				const source = new EventSource(`/api/sessions/${id}/events`);
				const timeout = setTimeout(() => {
					source.close();
					reject(new Error('SSE snapshot timeout'));
				}, 5000);
				source.addEventListener('snapshot', (event) => {
					clearTimeout(timeout);
					source.close();
					resolve(JSON.parse((event as MessageEvent).data));
				});
				source.onerror = () => {
					clearTimeout(timeout);
					source.close();
					reject(new Error('SSE failed'));
				};
			}),
		sessionId
	);
}

test('guided quiz syncs presenter question and timer state across two participants', async ({
	page,
	browser
}) => {
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Kata sandi').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await page.getByLabel('Judul aktivitas').fill(`Quiz terpandu ${Date.now()}`);
	await page.getByRole('button', { name: 'Buat aktivitas' }).click();
	await page.getByRole('link', { name: 'Buka editor' }).first().click();
	await page.getByLabel('Pertanyaan').fill('Soal terpandu satu');
	await page.getByPlaceholder('Jawaban A').fill('Benar');
	await page.getByPlaceholder('Jawaban B').fill('Salah');
	await page.getByRole('checkbox', { name: 'Tandai opsi A sebagai jawaban benar' }).check();
	await page.getByRole('button', { name: /Simpan pertanyaan/ }).click();
	await page.getByRole('button', { name: /Tambah pertanyaan/ }).click();
	await page.getByLabel('Pertanyaan').fill('Soal terpandu dua');
	await page.getByPlaceholder('Jawaban A').fill('Ya');
	await page.getByPlaceholder('Jawaban B').fill('Tidak');
	await page
		.getByRole('group', { name: 'Pilihan jawaban — centang' })
		.getByRole('checkbox', { name: 'Tandai opsi B sebagai jawaban benar' })
		.check();
	await page.getByRole('button', { name: /Simpan pertanyaan/ }).click();
	await page.getByLabel('Mode kuis').selectOption('guided');
	const popup = page.context().waitForEvent('page');
	await page.getByRole('button', { name: /Luncurkan kuis/ }).click();
	const presenter = await popup;
	await presenter.waitForLoadState();
	const code = (await presenter.getByTestId('session-code').textContent())!.trim();

	const context = await browser.newContext();
	const secondContext = await browser.newContext();
	try {
		const first = await context.newPage();
		const second = await secondContext.newPage();
		for (const [student, name] of [
			[first, 'Satu'],
			[second, 'Dua']
		] as const) {
			await student.goto(`/join?code=${code}`);
			await student.getByLabel('Nama tampilan').fill(name);
			await student.getByRole('button', { name: 'Bergabung' }).click();
			await expect(student.getByTestId('session-state')).toHaveText('Menunggu dosen membuka sesi');
			await expect(student.getByTestId('waiting-room')).toBeVisible();
			await expect(student.getByText('Soal terpandu satu')).toHaveCount(0);
		}
		await expect(presenter.getByTestId('post-session-review-nav')).toHaveCount(0);
		await expect(presenter.getByRole('button', { name: 'Tinjau soal' })).toHaveCount(0);
		await presenter.getByRole('button', { name: 'Buka sesi', exact: true }).click();
		for (const student of [first, second]) {
			await expect(student.getByTestId('choice-player')).toBeVisible();
			await expect(student.getByText('Soal terpandu satu')).toBeVisible();
			await expect(student.getByTestId('quiz-timer')).not.toContainText('Tanpa timer');
			await expect(student.getByRole('button', { name: 'Kirim jawaban' })).toBeVisible();
		}
		const id = presenter.url().split('/').pop()!;
		const q1 = (await readSnapshot(presenter, id)).question!;
		const hidden = await readSnapshot(first, id);
		expect(hidden.quizMode).toBe('guided');
		expect(hidden.question).toBeUndefined();
		expect(hidden.tally).toBeUndefined();
		expect((await first.request.get(`/api/polls/${code}/results?leaderboard=true`)).status()).toBe(
			403
		);
		await presenter.getByRole('button', { name: 'Stop timer' }).click();
		await expect(first.getByTestId('quiz-timer')).toContainText('Timer dijeda');
		expect(
			(
				await first.request.post(`/api/polls/${code}/responses`, {
					headers: { origin: 'http://127.0.0.1:4173' },
					data: { questionId: q1.id, optionIds: [q1.options[0].id] }
				})
			).status()
		).toBe(400);
		await first.addInitScript(() => {
			const nativeNow = Date.now;
			Date.now = () => nativeNow() + 600000;
		});
		await first.reload();
		await expect(first.getByTestId('quiz-timer')).toContainText('Timer dijeda');
		await presenter.getByRole('button', { name: 'Stop timer' }).click();
		await presenter.getByRole('button', { name: 'Reset timer' }).click();
		await expect(first.getByTestId('quiz-timer')).not.toContainText('Timer dijeda');
		const expire = await presenter.request.post(presenter.url(), {
			headers: { origin: 'http://127.0.0.1:4173', 'x-sveltekit-action': 'true' },
			form: { action: 'timer', questionId: q1.id, running: 'true', reset: 'true', duration: '1' }
		});
		expect((await expire.json()).type).toBe('success');
		await expect(first.getByTestId('quiz-timer')).toContainText('Waktu habis');
		expect(
			(
				await first.request.post(`/api/polls/${code}/responses`, {
					headers: { origin: 'http://127.0.0.1:4173' },
					data: { questionId: q1.id, optionIds: [q1.options[0].id] }
				})
			).status()
		).toBe(400);
		await presenter.getByTestId('fullscreen-button').click();
		await presenter.mouse.move(20, 20);
		const dock = presenter.getByTestId('session-controls');
		const nav = dock.getByTestId('presenter-navigation');
		await expect(nav).toHaveCount(1);
		await expect(nav.getByRole('button', { name: 'Sebelumnya' })).toBeVisible();
		await expect(nav.getByRole('button', { name: 'Berikutnya' })).toBeVisible();
		await expect(nav.getByTestId('exit-fullscreen')).toBeVisible();
		const a = (await dock.boundingBox())!;
		expect(a.x).toBeGreaterThanOrEqual(0);
		expect(a.x + a.width).toBeLessThanOrEqual(presenter.viewportSize()!.width);
		await secondContext.setOffline(true);
		await presenter.getByRole('button', { name: 'Berikutnya' }).click();
		await expect(first.getByText('Soal terpandu dua')).toBeVisible();
		await secondContext.setOffline(false);
		await expect(second.getByText('Soal terpandu dua')).toBeVisible({ timeout: 15000 });
		expect(
			(
				await first.request.post(`/api/polls/${code}/responses`, {
					headers: { origin: 'http://127.0.0.1:4173' },
					data: { questionId: q1.id, optionIds: [q1.options[0].id] }
				})
			).status()
		).toBe(400);
		const refreshed = await readSnapshot(first, id);
		expect(refreshed.activeQuestionId).not.toBe(q1.id);
		expect(refreshed.timerDeadline).toBeGreaterThan(Date.now());
		await expect(first.getByTestId('quiz-timer')).not.toContainText('Tanpa timer');
		await first.reload();
		await expect(first.getByText('Soal terpandu dua')).toBeVisible();
		await expect(first.getByText('Perpindahan soal mengikuti dosen.')).toHaveCount(0);
		await presenter.keyboard.press('Escape');
		const guests = await browser.newContext();
		try {
			for (let i = 0; i < 12; i++) {
				await guests.clearCookies();
				const joined = await guests.request.post('http://127.0.0.1:4173/api/join', {
					headers: { origin: 'http://127.0.0.1:4173' },
					data: { code, displayName: `Peserta ${i + 1}` }
				});
				expect(joined.ok()).toBe(true);
			}
		} finally {
			await guests.close();
		}
		await presenter.getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
		await expect(presenter.getByTestId('quiz-leaderboard')).toBeVisible();
		await expect(presenter.getByTestId('leaderboard-starfall')).toBeVisible();
		await expect(
			presenter.getByRole('button', { name: 'Tampilkan hasil ke mahasiswa' })
		).toHaveCount(0);
		const sheet = presenter.getByTestId('quiz-leaderboard-scroll');
		await expect(sheet).toBeVisible();
		await presenter.getByTestId('fullscreen-button').click();
		await presenter.mouse.move(1, 1);
		await expect
			.poll(() => sheet.evaluate((el) => el.scrollHeight - el.clientHeight))
			.toBeGreaterThan(100);
		await expect.poll(() => sheet.evaluate((el) => el.scrollTop)).toBeGreaterThan(5);
		const box = (await sheet.boundingBox())!;
		const dockBox = (await presenter.getByTestId('session-controls').boundingBox())!;
		expect(box.y + box.height).toBeLessThan(dockBox.y);
		await presenter.getByRole('button', { name: 'Jeda gulir', exact: true }).click();
		const stopped = await sheet.evaluate((el) => el.scrollTop);
		await presenter.waitForTimeout(200);
		expect(await sheet.evaluate((el) => el.scrollTop)).toBe(stopped);
		await sheet.evaluate((el) => {
			el.scrollTop = el.scrollHeight - el.clientHeight;
		});
		await presenter.getByRole('button', { name: 'Lanjutkan gulir', exact: true }).click();
		await expect.poll(() => sheet.evaluate((el) => el.scrollTop), { timeout: 4000 }).toBe(0);
		await expect.poll(() => sheet.evaluate((el) => el.scrollTop)).toBeGreaterThan(5);
		await presenter.emulateMedia({ reducedMotion: 'reduce' });
		await expect(
			presenter.getByRole('button', { name: 'Lanjutkan gulir', exact: true })
		).toBeVisible();
		await presenter.screenshot({ path: 'test-results/leaderboard-ended.png' });
		await presenter.keyboard.press('Escape');
		await expect.poll(() => sheet.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
		await expect(first.getByTestId('session-state')).toHaveText('Sesi selesai');
		await expect(presenter.getByTestId('post-session-review-nav')).toBeVisible();
		await presenter.getByRole('button', { name: 'Tinjau soal' }).click();
		await presenter.getByRole('button', { name: 'Soal 1: Soal terpandu satu' }).click();
		await expect(presenter.getByTestId('presenter-stage')).toBeVisible();
		await presenter.waitForTimeout(300);
		await expect(presenter.getByTestId('quiz-leaderboard')).toHaveCount(0);
		await expect(first.getByText('Soal terpandu satu')).toBeVisible();
		expect(
			(
				await first.request.post(`/api/polls/${code}/responses`, {
					headers: { origin: 'http://127.0.0.1:4173' },
					data: { questionId: q1.id, optionIds: [q1.options[0].id] }
				})
			).status()
		).toBe(400);
	} finally {
		await context.close();
		await secondContext.close();
	}
});
