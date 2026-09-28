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
	getChoiceQuestionsByActivity,
	participantChoiceResponses,
	quizLeaderboard,
	setChoiceCorrectOptions,
	setChoiceResults,
	submitChoiceResponse
} from '../../src/lib/server/poll/choice';
const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.sqlite.close()));
async function fixture() {
	const store = openDatabase(':memory:');
	stores.push(store);
	const admin = await seedAdmin(store, {
		email: 'quiz@example.test',
		password: 'test-quiz-password-long'
	});
	const activity = createActivity(store, admin.id, { title: 'Quiz kelas', type: 'choice' });
	const session = launchSession(store, admin.id, activity.id);
	changeState(store, admin.id, session.id, 'open');
	const ana = joinSession(store, { code: session.code, displayName: 'Ana' });
	const bayu = joinSession(store, { code: session.code, displayName: 'Bayu' });
	return { store, admin, activity, session, ana, bayu };
}
test('quiz accepts multiple questions and multiple correct options', async () => {
	const { store, admin, activity } = await fixture();
	const question = createChoiceQuestion(store, admin.id, activity.id, {
		prompt: 'Pilih dua',
		options: ['A', 'B', 'C'],
		correctOptions: [0, 2]
	});
	expect(getChoiceQuestionsByActivity(store, activity.id)).toHaveLength(1);
	expect(
		question.options.filter((option) => option.isCorrect).map((option) => option.position)
	).toEqual([0, 2]);
});
test('a response scores only when the complete correct set matches; duplicate is idempotent', async () => {
	const { store, admin, activity, session, ana, bayu } = await fixture();
	const question = createChoiceQuestion(store, admin.id, activity.id, {
		prompt: 'Pilih dua',
		options: ['A', 'B', 'C'],
		correctOptions: [0, 2]
	});
	const correct = submitChoiceResponse(store, session.id, question.id, ana.token, [
		question.options[0].id,
		question.options[2].id
	]);
	expect(correct.isCorrect).toBe(true);
	expect(correct.points).toBe(1000);
	expect(
		submitChoiceResponse(store, session.id, question.id, ana.token, [question.options[0].id])
	).toEqual(correct);
	const partial = submitChoiceResponse(store, session.id, question.id, bayu.token, [
		question.options[0].id
	]);
	expect(partial.isCorrect).toBe(false);
	expect(partial.points).toBe(0);
});
test('owner can update multiple correct options and leaderboard ranks all participants', async () => {
	const { store, admin, activity, session, ana, bayu } = await fixture();
	const question = createChoiceQuestion(store, admin.id, activity.id, {
		prompt: 'Pilih',
		options: ['A', 'B', 'C'],
		correctOptions: [0]
	});
	setChoiceCorrectOptions(store, admin.id, question.id, [
		question.options[0].id,
		question.options[2].id
	]);
	submitChoiceResponse(store, session.id, question.id, ana.token, [
		question.options[0].id,
		question.options[2].id
	]);
	submitChoiceResponse(store, session.id, question.id, bayu.token, [question.options[1].id]);
	expect(
		quizLeaderboard(store, session.id).map((entry) => [entry.rank, entry.displayName, entry.score])
	).toEqual([
		[1, 'Ana', 1000],
		[2, 'Bayu', 0]
	]);
});
test('response cannot target another activity and closed sessions reject', async () => {
	const { store, admin, session, ana } = await fixture();
	const other = createActivity(store, admin.id, { title: 'Other', type: 'choice' });
	const question = createChoiceQuestion(store, admin.id, other.id, {
		prompt: 'Other?',
		options: ['X', 'Y'],
		correctOptions: [0]
	});
	expect(() =>
		submitChoiceResponse(store, session.id, question.id, ana.token, [question.options[0].id])
	).toThrow('Pilihan tidak tersedia.');
	changeState(store, admin.id, session.id, 'closed');
});
test('hasil tetap privat sampai dibuka lalu skor peserta pulih', async () => {
	const { store, admin, activity, session, ana } = await fixture();
	const question = createChoiceQuestion(store, admin.id, activity.id, {
		prompt: 'Pilih dua',
		options: ['A', 'B', 'C'],
		correctOptions: [0, 2]
	});
	submitChoiceResponse(store, session.id, question.id, ana.token, [
		question.options[0].id,
		question.options[2].id
	]);
	const hidden = participantChoiceResponses(store, session.id, ana.token)[0];
	expect(hidden.isCorrect).toBeNull();
	expect(hidden.points).toBe(0);
	expect(hidden.correctOptionIds).toEqual([]);
	setChoiceResults(store, admin.id, question.id, true);
	const revealed = participantChoiceResponses(store, session.id, ana.token)[0];
	expect(revealed.isCorrect).toBe(true);
	expect(revealed.points).toBe(1000);
	expect(revealed.correctOptionIds).toEqual([]);
});
