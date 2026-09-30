import { expect, test } from '@playwright/test';

test('quiz supports a question bank, multiple correct answers, and a game-show student flow', async ({
	page,
	browser
}) => {
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('phase1@example.test');
	await page.getByLabel('Password').fill('phase1-test-only-password-2026');
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	await page.getByRole('button', { name: 'Create Quiz' }).click();
	const dialog = page.getByRole('dialog', { name: 'Create activity' });
	await dialog.getByLabel('Activity title').fill(`Kuis Game Show ${Date.now()}`);
	await dialog.getByRole('button', { name: 'Create activity', exact: true }).click();
	await expect(page).toHaveURL(/admin\/activities\//);

	await page.getByLabel('Question').fill('Apa ibu kota Indonesia?');
	await page.getByPlaceholder('Answer A').fill('Jakarta');
	await page.getByPlaceholder('Answer B').fill('Bandung');
	await page.getByPlaceholder('Answer C').fill('Surabaya');
	await page.getByRole('checkbox', { name: 'Mark option A as correct' }).check();
	await page.getByRole('checkbox', { name: 'Mark option C as correct' }).check();
	await page.getByRole('button', { name: /Save question/ }).click();
	await expect(page.getByText('Question 1 saved.')).toBeVisible();
	await expect(page.getByText('Apa ibu kota Indonesia?')).toBeVisible();
	await expect(page.getByText('CORRECT', { exact: true })).toHaveCount(2);

	await page.getByRole('button', { name: /Add question/ }).click();
	await page.getByLabel('Question').fill('2 + 2 berapa?');
	await page.getByPlaceholder('Answer A').fill('3');
	await page.getByPlaceholder('Answer B').fill('4');
	await page
		.getByRole('group', { name: 'Answer choices — select all correct answers' })
		.getByRole('checkbox', { name: 'Mark option B as correct' })
		.check();
	await page.getByRole('button', { name: /Save question/ }).click();
	await expect(page.getByText('Question 2 saved.')).toBeVisible();
	await expect(page.getByText('2 + 2 berapa?')).toBeVisible();

	await page.getByLabel('Quiz mode').selectOption('self_paced');
	const popupPromise = page.context().waitForEvent('page');
	await page.getByRole('button', { name: /Launch quiz/ }).click();
	const presenter = await popupPromise;
	await presenter.waitForLoadState();
	await expect(presenter).toHaveURL(/admin\/sessions\//);
	await presenter.bringToFront();
	page = presenter;
	await expect(page.getByTestId('joining-instructions')).toBeVisible();
	await expect(page.getByRole('img', { name: 'Session QR code' })).toBeVisible();
	await expect(page.getByTestId('presenter-stage')).toHaveCount(0);
	const code = (await page.getByTestId('session-code').textContent())!.trim();
	await page.getByRole('button', { name: 'Open session', exact: true }).click();

	const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
	try {
		const student = await context.newPage();
		await student.goto(`/join?code=${code}`);
		await student.getByLabel('Display name').fill('Ayu');
		await student.getByRole('button', { name: 'Join session' }).click();
		await expect(student.getByTestId('choice-player')).toBeVisible();
		await expect(student.getByTestId('student-floating-name')).toHaveText('👤 Ayu');
		await expect(student.getByText('Round 1 of 2')).toBeVisible();
		await expect
			.poll(() =>
				student
					.getByTestId('answer-grid')
					.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
			)
			.toBe(1);
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
		await expect(student.getByRole('button', { name: /Jakarta/ })).toHaveCSS(
			'border-top-width',
			'4px'
		);
		await expect(student.getByTestId('student-floating-name')).toHaveText('👤 Ayu');
		await expect(student.getByRole('button', { name: 'Previous question' })).toBeVisible();
		await expect(student.getByRole('button', { name: 'Next question' })).toBeVisible();
		await student.getByRole('button', { name: /Submit answer/ }).click();
		await expect(student.getByRole('status')).toHaveText('Answer saved.');
		await expect(student.getByText('Correct', { exact: true })).toHaveCount(0);
		await expect(student.getByText('Class results', { exact: true })).toHaveCount(0);
		await student.getByRole('button', { name: 'Next question' }).click();
		await expect(student.getByText('Round 2 of 2')).toBeVisible();
		await student.getByRole('button', { name: /4/ }).click();
		await student.getByRole('button', { name: /Submit answer/ }).click();
		await expect(student.getByRole('status')).toHaveText('Answer saved.');
		await expect(student.getByText('Correct', { exact: true })).toHaveCount(0);
		await expect(student.getByText('Class results', { exact: true })).toHaveCount(0);
		await student.getByRole('button', { name: 'Finish', exact: true }).click();
		await expect(student.getByTestId('quiz-finished')).toContainText(
			'Your answers have been saved.'
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
		await expect(student.getByRole('status')).toHaveText('Answer saved.');
		await expect(student.locator('.choices button.correct')).toHaveCount(0);
		await expect(student.getByText('Class results', { exact: true })).toHaveCount(0);

		const csv = await page.request.get(`/api/polls/${code}/export`);
		expect(csv.ok()).toBe(true);
		const text = await csv.text();
		expect(text).toContain('Ayu');
		expect(text).toContain('Jakarta,Surabaya');
	} finally {
		await context.close();
	}
	await page.getByRole('button', { name: 'End session', exact: true }).click();
	await expect(page.getByTestId('quiz-leaderboard')).toBeVisible();
	await expect(page.getByTestId('leaderboard-starfall')).toBeVisible();
	await expect(page.getByText('Class champions')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'Ayu' })).toBeVisible();
	await expect(
		page.getByRole('row', { name: /Ayu/ }).getByText('2,000', { exact: true })
	).toBeVisible();
	await page.getByRole('button', { name: 'Review questions' }).click();
	await page.getByRole('button', { name: 'Question 1: Apa ibu kota Indonesia?' }).click();
	await expect(page.getByTestId('presenter-stage')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Show results to students' })).toHaveCount(0);
});
