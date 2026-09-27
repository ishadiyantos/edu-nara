import { afterEach, expect, test } from 'vitest';
import { openDatabase } from '../../src/lib/server/db/client';
import { seedAdmin } from '../../src/lib/server/auth';
import { changeState, createActivity, joinSession, launchSession } from '../../src/lib/server/sessions';
import { createChoiceQuestion, submitChoiceResponse } from '../../src/lib/server/poll/choice';
import { choiceExportRows } from '../../src/lib/server/poll/export';

const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.sqlite.close()));

test('choice export includes one aggregate row per response', async () => {
	const store = openDatabase(':memory:');
	stores.push(store);
	const admin = await seedAdmin(store, { email: 'export@example.test', password: 'test-export-password-long' });
	const activity = createActivity(store, admin.id, { title: 'Export', type: 'choice' });
	const session = launchSession(store, admin.id, activity.id);
	changeState(store, admin.id, session.id, 'open');
	const participant = joinSession(store, { code: session.code, displayName: '=Ayu' });
	const question = createChoiceQuestion(store, admin.id, activity.id, {
		prompt: 'Pilih', options: ['A', 'B'], correctOptions: [0]
	});
	submitChoiceResponse(store, session.id, question.id, participant.token, [question.options[0].id]);

	expect(choiceExportRows(store, session.id)).toEqual([
		['Peserta', 'Soal', 'Jawaban', 'Poin', 'Benar'],
		['=Ayu', 'Pilih', 'A', 1000, 'Ya']
	]);
});
