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
	activeQuestionId,
	advanceActiveQuestion,
	setActiveQuestion,
	createWordcloudQuestion,
	getWordcloudQuestionsByActivity,
	moderateWordcloudResponse,
	moderationQueue,
	submitWordcloudResponse,
	wordcloudSnapshot
} from '../../src/lib/server/poll/wordcloud';
const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.sqlite.close()));
async function fixture() {
	const store = openDatabase(':memory:');
	stores.push(store);
	const admin = await seedAdmin(store, {
		email: 'wordcloud@example.test',
		password: 'test-wordcloud-password-long'
	});
	const activity = createActivity(store, admin.id, { title: 'Awan kata', type: 'wordcloud' });
	const session = launchSession(store, admin.id, activity.id);
	changeState(store, admin.id, session.id, 'open');
	const ana = joinSession(store, { code: session.code, displayName: 'Ana' });
	const bayu = joinSession(store, { code: session.code, displayName: 'Bayu' });
	return { store, admin, activity, session, ana, bayu };
}
test('wordcloud question is stored with its own kind and limits', async () => {
	const { store, admin, activity } = await fixture();
	const question = createWordcloudQuestion(store, admin.id, activity.id, {
		prompt: 'Satu kata untuk kelas ini?',
		wordLimit: 2,
		moderationEnabled: true
	});
	expect(question.kind).toBe('wordcloud');
	expect(getWordcloudQuestionsByActivity(store, activity.id)).toHaveLength(1);
});
test('wordcloud submissions normalize, merge variants, cap per participant and stay hidden until approved', async () => {
	const { store, admin, activity, session, ana, bayu } = await fixture();
	const question = createWordcloudQuestion(store, admin.id, activity.id, {
		prompt: 'Satu kata untuk kelas ini?',
		wordLimit: 2,
		moderationEnabled: true
	});
	const first = submitWordcloudResponse(store, session.id, question.id, ana.token, '  Seru  ');
	expect(first.row.word).toBe('seru');
	expect(first.row.status).toBe('pending');
	const duplicate = submitWordcloudResponse(store, session.id, question.id, bayu.token, 'SERU');
	expect(duplicate.row.word).toBe('seru');
	submitWordcloudResponse(store, session.id, question.id, bayu.token, 'interaktif');
	expect(() =>
		submitWordcloudResponse(store, session.id, question.id, bayu.token, 'kelebihan')
	).toThrow();
	expect(wordcloudSnapshot(store, session.id, question.id)).toEqual([]);
	const queue = moderationQueue(store, admin.id, session.id, question.id);
	expect(queue).toHaveLength(3);
	const approved = moderateWordcloudResponse(store, admin.id, queue[0].id, 'approved');
	expect(approved.status).toBe('approved');
	expect(wordcloudSnapshot(store, session.id, question.id)).toEqual([{ word: 'seru', weight: 1 }]);
	moderateWordcloudResponse(
		store,
		admin.id,
		queue.find((row) => row.id !== queue[0].id)!.id,
		'rejected'
	);
	expect(wordcloudSnapshot(store, session.id, question.id)).toEqual([{ word: 'seru', weight: 1 }]);
});
test('wordcloud submissions are approved automatically when moderation is off', async () => {
	const { store, admin, activity, session, ana } = await fixture();
	const question = createWordcloudQuestion(store, admin.id, activity.id, {
		prompt: 'Kesan pertama?',
		wordLimit: 1,
		moderationEnabled: false
	});
	const result = submitWordcloudResponse(store, session.id, question.id, ana.token, 'ringan');
	expect(result.row.status).toBe('approved');
	expect(wordcloudSnapshot(store, session.id, question.id)).toEqual([
		{ word: 'ringan', weight: 1 }
	]);
});
test('owner advances the active question and participants follow the same one', async () => {
	const { store, admin, activity, session } = await fixture();
	const first = createWordcloudQuestion(store, admin.id, activity.id, {
		prompt: 'Pertanyaan satu?',
		wordLimit: 2,
		moderationEnabled: true
	});
	const second = createWordcloudQuestion(store, admin.id, activity.id, {
		prompt: 'Pertanyaan dua?',
		wordLimit: 2,
		moderationEnabled: true
	});
	expect(activeQuestionId(store, session.id)).toBe(first.id);
	expect(advanceActiveQuestion(store, admin.id, session.id, 1)).toBe(second.id);
	expect(activeQuestionId(store, session.id)).toBe(second.id);
	expect(advanceActiveQuestion(store, admin.id, session.id, 1)).toBe(second.id);
	expect(advanceActiveQuestion(store, admin.id, session.id, -1)).toBe(first.id);
	expect(advanceActiveQuestion(store, admin.id, session.id, -1)).toBe(first.id);
});
test('launch selects first question, isolates sessions, allows ended review but rejects inactive and ended submissions', async () => {
	const { store, admin, activity, session, ana } = await fixture();
	const first = createWordcloudQuestion(store, admin.id, activity.id, {
		prompt: 'Pertama?',
		wordLimit: 2,
		moderationEnabled: false
	});
	const second = createWordcloudQuestion(store, admin.id, activity.id, {
		prompt: 'Kedua?',
		wordLimit: 2,
		moderationEnabled: false
	});
	const other = launchSession(store, admin.id, activity.id);
	expect(other.activeQuestionId).toBe(first.id);
	expect(() => submitWordcloudResponse(store, session.id, second.id, ana.token, 'belum')).toThrow(
		/aktif/
	);
	setActiveQuestion(store, admin.id, session.id, second.id);
	expect(activeQuestionId(store, other.id)).toBe(first.id);
	expect(() => submitWordcloudResponse(store, session.id, first.id, ana.token, 'lama')).toThrow(
		/aktif/
	);
	submitWordcloudResponse(store, session.id, second.id, ana.token, 'baru');
	const foreign = createActivity(store, admin.id, { title: 'Lain', type: 'wordcloud' });
	const foreignQuestion = createWordcloudQuestion(store, admin.id, foreign.id, {
		prompt: 'Asing?',
		wordLimit: 1,
		moderationEnabled: true
	});
	expect(() => setActiveQuestion(store, admin.id, session.id, foreignQuestion.id)).toThrow();
	changeState(store, admin.id, session.id, 'ended');
	expect(setActiveQuestion(store, admin.id, session.id, first.id)).toBe(first.id);
	expect(advanceActiveQuestion(store, admin.id, session.id, 1)).toBe(second.id);
	expect(() => submitWordcloudResponse(store, session.id, second.id, ana.token, 'tambah')).toThrow(
		/Sesi tidak menerima jawaban\./
	);
});
test('a non-owner cannot advance the active question', async () => {
	const { store, admin, activity, session, ana } = await fixture();
	createWordcloudQuestion(store, admin.id, activity.id, {
		prompt: 'Pertanyaan satu?',
		wordLimit: 2,
		moderationEnabled: true
	});
	createWordcloudQuestion(store, admin.id, activity.id, {
		prompt: 'Pertanyaan dua?',
		wordLimit: 2,
		moderationEnabled: true
	});
	expect(() => advanceActiveQuestion(store, ana.token, session.id, 1)).toThrow();
});
