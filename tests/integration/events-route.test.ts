import { afterEach, expect, test } from 'vitest';
import { openDatabase } from '../../src/lib/server/db/client';
import { seedAdmin } from '../../src/lib/server/auth';
import {
	changeState,
	createActivity,
	joinSession,
	launchSession
} from '../../src/lib/server/sessions';
import { createChoiceQuestion, submitChoiceResponse } from '../../src/lib/server/poll/choice';
import { sessionEventSnapshot } from '../../src/lib/server/session-events';

const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.sqlite.close()));

test('participant SSE snapshot excludes owner question and tally while owner receives both', async () => {
	const store = openDatabase(':memory:');
	stores.push(store);
	const admin = await seedAdmin(store, {
		email: 'events@example.test',
		password: 'test-events-password-long'
	});
	const activity = createActivity(store, admin.id, { title: 'SSE privacy', type: 'choice' });
	const question = createChoiceQuestion(store, admin.id, activity.id, {
		prompt: 'Rahasia?',
		options: ['A', 'B'],
		correctOptions: [0]
	});
	const session = launchSession(store, admin.id, activity.id);
	changeState(store, admin.id, session.id, 'open');
	const participant = joinSession(store, { code: session.code, displayName: 'Peserta' });
	submitChoiceResponse(store, session.id, question.id, participant.token, [question.options[0].id]);

	const ownerSnapshot = sessionEventSnapshot(store, session.id, 'choice', activity.id, true);
	const participantSnapshot = sessionEventSnapshot(store, session.id, 'choice', activity.id, false);

	expect(ownerSnapshot).toHaveProperty('question');
	expect(ownerSnapshot).toHaveProperty('tally');
	expect(participantSnapshot).not.toHaveProperty('question');
	expect(participantSnapshot).not.toHaveProperty('tally');
});
