import { afterEach, expect, test } from 'vitest';
import { openDatabase } from '../../src/lib/server/db/client';
import { seedAdmin } from '../../src/lib/server/auth';
import { changeState, createActivity, joinSession, launchSession } from '../../src/lib/server/sessions';
import {
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
	expect(() => submitWordcloudResponse(store, session.id, question.id, bayu.token, 'kelebihan')).toThrow();
	expect(wordcloudSnapshot(store, session.id, question.id)).toEqual([]);
	const queue = moderationQueue(store, admin.id, session.id, question.id);
	expect(queue).toHaveLength(3);
	const approved = moderateWordcloudResponse(store, admin.id, queue[0].id, 'approved');
	expect(approved.status).toBe('approved');
	expect(wordcloudSnapshot(store, session.id, question.id)).toEqual([{ word: 'seru', weight: 1 }]);
	moderateWordcloudResponse(store, admin.id, queue.find((row) => row.id !== queue[0].id)!.id, 'rejected');
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
	expect(wordcloudSnapshot(store, session.id, question.id)).toEqual([{ word: 'ringan', weight: 1 }]);
});
