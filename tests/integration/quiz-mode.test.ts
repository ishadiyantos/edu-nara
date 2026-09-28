import { afterEach, expect, test } from 'vitest';
import { openDatabase } from '../../src/lib/server/db/client';
import { seedAdmin } from '../../src/lib/server/auth';
import {
	changeState,
	createActivity,
	joinSession,
	launchSession
} from '../../src/lib/server/sessions';
import {
	createChoiceQuestion,
	quizLeaderboard,
	setActiveChoiceQuestion,
	setChoiceTimer,
	setChoiceResults,
	submitChoiceResponse,
	advanceActiveChoiceQuestion
} from '../../src/lib/server/poll/choice';

const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.sqlite.close()));

async function fixture(mode: 'guided' | 'self_paced' = 'guided') {
	const store = openDatabase(':memory:');
	stores.push(store);
	const admin = await seedAdmin(store, {
		email: `quiz-mode-${mode}@example.test`,
		password: 'test-quiz-password-long'
	});
	const activity = createActivity(store, admin.id, { title: `Quiz ${mode}`, type: 'choice' });
	const session = launchSession(store, admin.id, activity.id, undefined, mode);
	changeState(store, admin.id, session.id, 'open');
	const first = createChoiceQuestion(store, admin.id, activity.id, {
		prompt: 'Soal satu',
		options: ['A', 'B'],
		correctOptions: [0]
	});
	const second = createChoiceQuestion(store, admin.id, activity.id, {
		prompt: 'Soal dua',
		options: ['A', 'B'],
		correctOptions: [1]
	});
	const ana = joinSession(store, { code: session.code, displayName: 'Ana' });
	return { store, admin, activity, session, first, second, ana };
}

test('session stores the quiz mode chosen at launch', async () => {
	const { store, session } = await fixture('self_paced');
	expect(session.quizMode).toBe('self_paced');
	const snapshot = store.sqlite
		.prepare('SELECT quiz_mode FROM live_sessions WHERE id = ?')
		.get(session.id) as { quiz_mode: string };
	expect(snapshot.quiz_mode).toBe('self_paced');
});

test('guided mode gates answering to the server-side active question', async () => {
	const { store, admin, session, first, second, ana } = await fixture();
	setActiveChoiceQuestion(store, admin.id, session.id, first.id);
	expect(() =>
		submitChoiceResponse(store, session.id, second.id, ana.token, [second.options[0].id])
	).toThrow();
	const accepted = submitChoiceResponse(store, session.id, first.id, ana.token, [
		first.options[0].id
	]);
	expect(accepted.questionId).toBe(first.id);
});

test('self-paced mode accepts any question of the session activity', async () => {
	const { store, session, second, ana } = await fixture('self_paced');
	const accepted = submitChoiceResponse(store, session.id, second.id, ana.token, [
		second.options[1].id
	]);
	expect(accepted.questionId).toBe(second.id);
});

test('guided navigation moves the active question and ignores out-of-range moves', async () => {
	const { store, admin, session, first, second } = await fixture();
	expect(setActiveChoiceQuestion(store, admin.id, session.id, first.id)).toBe(first.id);
	expect(advanceActiveChoiceQuestion(store, admin.id, session.id, 1)).toBe(second.id);
	expect(advanceActiveChoiceQuestion(store, admin.id, session.id, 1)).toBe(second.id);
	expect(advanceActiveChoiceQuestion(store, admin.id, session.id, -1)).toBe(first.id);
});

test('a running timer exposes a shared deadline and stops on pause', async () => {
	const { store, admin, session, first } = await fixture();
	setActiveChoiceQuestion(store, admin.id, session.id, first.id);
	const started = setChoiceTimer(store, admin.id, session.id, {
		questionId: first.id,
		running: true,
		duration: 30
	});
	expect(started.timerRunning).toBe(true);
	expect(started.timerDeadline).toBeGreaterThan(Date.now());
	const paused = setChoiceTimer(store, admin.id, session.id, {
		questionId: first.id,
		running: false
	});
	expect(paused.timerRunning).toBe(false);
	expect(paused.timerDeadline).toBeNull();
	expect(setActiveChoiceQuestion(store, admin.id, session.id, first.id)).toBe(first.id);
});

test('switching the active question clears the timer for the new question', async () => {
	const { store, admin, session, first, second } = await fixture();
	setActiveChoiceQuestion(store, admin.id, session.id, first.id);
	setChoiceTimer(store, admin.id, session.id, {
		questionId: first.id,
		running: true,
		duration: 60
	});
	const moved = advanceActiveChoiceQuestion(store, admin.id, session.id, 1);
	expect(moved).toBe(second.id);
	const row = store.sqlite
		.prepare('SELECT timer_deadline, timer_duration FROM live_sessions WHERE id = ?')
		.get(session.id) as { timer_deadline: number | null; timer_duration: number };
	expect(row.timer_deadline).toBeNull();
	expect(row.timer_duration).toBe(0);
});

test('pause retains remaining time, expired timer rejects responses until explicit reset', async () => {
	const { store, admin, session, first, ana } = await fixture();
	setActiveChoiceQuestion(store, admin.id, session.id, first.id);
	setChoiceTimer(store, admin.id, session.id, {
		questionId: first.id,
		running: true,
		duration: 30
	});
	const paused = setChoiceTimer(store, admin.id, session.id, {
		questionId: first.id,
		running: false
	});
	expect(paused.timerDuration).toBeGreaterThan(0);
	const resumed = setChoiceTimer(store, admin.id, session.id, {
		questionId: first.id,
		running: true
	});
	expect(resumed.timerDeadline).toBeGreaterThan(Date.now());
	store.sqlite
		.prepare('UPDATE live_sessions SET timer_deadline = ? WHERE id = ?')
		.run(Date.now() - 1, session.id);
	expect(() =>
		submitChoiceResponse(store, session.id, first.id, ana.token, [first.options[0].id])
	).toThrow('Waktu soal ini sudah habis.');
	expect(() =>
		setChoiceTimer(store, admin.id, session.id, { questionId: first.id, running: true })
	).toThrow('Timer habis. Reset timer untuk memulai lagi.');
	expect(
		setChoiceTimer(store, admin.id, session.id, {
			questionId: first.id,
			running: true,
			reset: true
		}).timerRunning
	).toBe(true);
});

test('guided control rejects foreign questions and all submissions stop after session end', async () => {
	const { store, admin, session, first, ana } = await fixture();
	const other = createActivity(store, admin.id, { title: 'Lain', type: 'choice' });
	const foreign = createChoiceQuestion(store, admin.id, other.id, {
		prompt: 'Bukan sesi ini',
		options: ['A', 'B'],
		correctOptions: [0]
	});
	expect(() => setActiveChoiceQuestion(store, admin.id, session.id, foreign.id)).toThrow(
		'Pertanyaan tidak tersedia untuk sesi ini.'
	);
	changeState(store, admin.id, session.id, 'ended');
	expect(() =>
		submitChoiceResponse(store, session.id, first.id, ana.token, [first.options[0].id])
	).toThrow('Sesi tidak menerima jawaban.');
});

test('leaderboard ranks participants by score without leaking pending answers', async () => {
	const { store, admin, session, first, ana } = await fixture();
	setActiveChoiceQuestion(store, admin.id, session.id, first.id);
	const guest = joinSession(store, { code: session.code, displayName: 'Bayu' });
	submitChoiceResponse(store, session.id, first.id, ana.token, [first.options[0].id]);
	submitChoiceResponse(store, session.id, first.id, guest.token, [first.options[1].id]);
	expect(
		store.db
			.select()
			.from((await import('../../src/lib/server/db/schema')).pollResponses)
			.all()
	).toHaveLength(2);
	const board = quizLeaderboard(store, session.id);
	expect(board.map((row) => row.displayName)).toEqual(['Ana', 'Bayu']);
	expect(board[0].score).toBe(1000);
	setChoiceResults(store, admin.id, first.id, true);
	expect(quizLeaderboard(store, session.id)[0].score).toBe(1000);
});
