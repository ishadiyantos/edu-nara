import { expect, test } from '@playwright/test';

test('quiz supports a question bank, multiple correct answers, and a game-show student flow', async ({
	page,
	browser
}) => {
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Kata sandi').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await page.getByLabel('Judul aktivitas').fill(`Kuis Game Show ${Date.now()}`);
	await page.getByRole('button', { name: 'Buat aktivitas' }).click();
	await page.getByRole('link', { name: 'Buka editor' }).first().click();

	await page.getByLabel('Pertanyaan').fill('Apa ibu kota Indonesia?');
	await page.getByPlaceholder('Jawaban A').fill('Jakarta');
	await page.getByPlaceholder('Jawaban B').fill('Bandung');
	await page.getByPlaceholder('Jawaban C').fill('Surabaya');
	await page.getByRole('checkbox', { name: 'Tandai opsi A sebagai jawaban benar' }).check();
	await page.getByRole('checkbox', { name: 'Tandai opsi C sebagai jawaban benar' }).check();
	await page.getByRole('button', { name: /Simpan pertanyaan/ }).click();
	await expect(page.getByText('Pertanyaan 1 tersimpan.')).toBeVisible();
	await expect(page.getByText('Apa ibu kota Indonesia?')).toBeVisible();
	await expect(page.getByText('BENAR', { exact: true })).toHaveCount(2);

	await page.getByRole('button', { name: /Tambah pertanyaan/ }).click();
	await page.getByLabel('Pertanyaan').fill('2 + 2 berapa?');
	await page.getByPlaceholder('Jawaban A').fill('3');
	await page.getByPlaceholder('Jawaban B').fill('4');
	await page
		.getByRole('group', { name: 'Pilihan jawaban — centang' })
		.getByRole('checkbox', { name: 'Tandai opsi B sebagai jawaban benar' })
		.check();
	await page.getByRole('button', { name: /Simpan pertanyaan/ }).click();
	await expect(page.getByText('Pertanyaan 2 tersimpan.')).toBeVisible();
	await expect(page.getByText('2 + 2 berapa?')).toBeVisible();

	await page.getByLabel('Mode kuis').selectOption('self_paced');
	const popupPromise = page.context().waitForEvent('page');
	await page.getByRole('button', { name: /Luncurkan kuis/ }).click();
	const presenter = await popupPromise;
	await presenter.waitForLoadState();
	await expect(presenter).toHaveURL(/admin\/sessions\//);
	await presenter.bringToFront();
	page = presenter;
	await expect(page.getByTestId('joining-instructions')).toBeVisible();
	await expect(page.getByRole('img', { name: 'QR code sesi' })).toBeVisible();
	await expect(page.getByTestId('presenter-stage')).toHaveCount(0);
	const code = (await page.getByTestId('session-code').textContent())!.trim();
	await page.getByRole('button', { name: 'Buka sesi', exact: true }).click();

	const context = await browser.newContext();
	try {
		const student = await context.newPage();
		await student.goto(`/join?code=${code}`);
		await student.getByLabel('Nama tampilan').fill('Ayu');
		await student.getByRole('button', { name: 'Bergabung' }).click();
		await expect(student.getByTestId('choice-player')).toBeVisible();
		await expect(student.getByTestId('student-floating-name')).toHaveText('👤Ayu');
		await expect(student.getByText('Ronde 1 dari 2')).toBeVisible();
		await expect
			.poll(() =>
				student
					.getByTestId('answer-grid')
					.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
			)
			.toBe(2);
		await student.getByRole('button', { name: /Jakarta/ }).click();
		await student.getByRole('button', { name: /Surabaya/ }).click();
		await student.reload();
		await expect(student.getByRole('button', { name: /Jakarta/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(student.getByRole('button', { name: /Surabaya/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await student.getByRole('button', { name: /Kirim jawaban/ }).click();
		await expect(student.getByRole('status')).toHaveText('Jawaban tersimpan.');
		await expect(student.getByText('Benar', { exact: true })).toHaveCount(0);
		await expect(student.getByText('Hasil kelas', { exact: true })).toHaveCount(0);
		await student.getByRole('button', { name: /Pertanyaan berikutnya/ }).click();
		await expect(student.getByText('Ronde 2 dari 2')).toBeVisible();
		await student.getByRole('button', { name: /4/ }).click();
		await student.getByRole('button', { name: /Kirim jawaban/ }).click();
		await expect(student.getByRole('status')).toHaveText('Jawaban tersimpan.');
		await expect(student.getByText('Benar', { exact: true })).toHaveCount(0);
		await expect(student.getByText('Hasil kelas', { exact: true })).toHaveCount(0);
		await student.getByRole('button', { name: 'Selesai' }).click();
		await expect(student.getByTestId('quiz-finished')).toContainText(
			'Jawaban Anda sudah tersimpan.'
		);

		await page.keyboard.press('Escape');
		// Owner results stay private from students even if presenter previews them.
		const ownedResult = await page.request.get(`/api/polls/${code}/results`);
		expect(ownedResult.ok()).toBe(true);
		const ownerData = await ownedResult.json();
		expect(ownerData.correctOptionIds).toHaveLength(2);
		expect((await student.request.get(`/api/polls/${code}/results`)).status()).toBe(403);
		const answers = await (await student.request.get(`/api/polls/${code}/responses`)).json();
		const [studentEvent] = await Promise.all([
			student.evaluate(
				(sessionId) =>
					new Promise<Record<string, unknown>>((resolve, reject) => {
						const source = new EventSource(`/api/sessions/${sessionId}/events`);
						const timer = setTimeout(() => {
							source.close();
							reject(new Error('SSE snapshot timeout'));
						}, 3000);
						source.addEventListener('snapshot', (event) => {
							clearTimeout(timer);
							source.close();
							resolve(JSON.parse((event as MessageEvent).data));
						});
					}),
				answers.snapshot.id
			),
			student.waitForTimeout(100)
		]);
		expect(studentEvent).not.toHaveProperty('tally');
		const answer = answers.responses.find(
			(a: { questionId: string }) => a.questionId === ownerData.questionId
		);
		expect(answer).not.toHaveProperty('isCorrect');
		expect(answer).not.toHaveProperty('points');
		expect(answer).not.toHaveProperty('correctOptionIds');
		const repeated = await student.request.post(`/api/polls/${code}/responses`, {
			headers: { origin: 'http://127.0.0.1:4173' },
			data: { questionId: answer.questionId, optionIds: answer.optionIds }
		});
		expect(repeated.ok()).toBe(true);
		const payload = await repeated.json();
		for (const key of ['isCorrect', 'points', 'correctOptionIds', 'tally'])
			expect(payload).not.toHaveProperty(key);
		await expect(student.getByTestId('quiz-finished')).toBeVisible();
		await student.reload();
		await expect(student.getByRole('status')).toHaveText('Jawaban tersimpan.');
		await expect(student.locator('.choices button.correct')).toHaveCount(0);
		await expect(student.getByText('Hasil kelas', { exact: true })).toHaveCount(0);

		const csv = await page.request.get(`/api/polls/${code}/export`);
		expect(csv.ok()).toBe(true);
		const text = await csv.text();
		expect(text).toContain('Ayu');
		expect(text).toContain('Jakarta,Surabaya');
	} finally {
		await context.close();
	}
	await page.getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
	await expect(page.getByTestId('quiz-leaderboard')).toBeVisible();
	await expect(page.getByTestId('leaderboard-starfall')).toBeVisible();
	await expect(page.getByText('Juara kelas')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'Ayu' })).toBeVisible();
	await page.getByRole('button', { name: 'Tinjau soal' }).click();
	await page.getByRole('button', { name: 'Soal 1: Apa ibu kota Indonesia?' }).click();
	await expect(page.getByTestId('presenter-stage')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Tampilkan hasil ke mahasiswa' })).toHaveCount(0);
});
