import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { database } from '$lib/server/db/client';
import { activities, pollQuestions } from '$lib/server/db/schema';
import { body, message, requireAdmin } from '$lib/server/http';
import {
	createWordcloudQuestion,
	getWordcloudQuestionsByActivity,
	updateWordcloudQuestion
} from '$lib/server/poll/wordcloud';

function owned(store: ReturnType<typeof database>, ownerId: string, id: string) {
	const activity = store.db
		.select()
		.from(activities)
		.where(
			and(eq(activities.id, id), eq(activities.ownerId, ownerId), eq(activities.type, 'wordcloud'))
		)
		.get();
	if (!activity) error(404, 'Aktivitas tidak ditemukan.');
	return activity;
}

export const load: import('./$types').PageServerLoad = (event) => {
	const store = database();
	const owner = requireAdmin(event);
	const activity = owned(store, owner, event.params.id);
	return {
		activity,
		questions: getWordcloudQuestionsByActivity(store, activity.id)
	};
};

export const actions = {
	save: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			const input = {
				prompt: data.prompt,
				wordLimit: data.wordLimit,
				moderationEnabled: data.moderationEnabled === 'on'
			};
			const store = database();
			owned(store, owner, event.params.id);
			if (data.questionId) {
				const row = store.db
					.select({ id: pollQuestions.id })
					.from(pollQuestions)
					.where(
						and(
							eq(pollQuestions.id, String(data.questionId)),
							eq(pollQuestions.activityId, event.params.id),
							eq(pollQuestions.kind, 'wordcloud')
						)
					)
					.get();
				if (!row) return fail(404, { message: 'Pertanyaan tidak ditemukan.' });
				updateWordcloudQuestion(store, owner, row.id, input);
			} else {
				createWordcloudQuestion(store, owner, event.params.id, input);
			}
			return { message: 'Pertanyaan tersimpan.' };
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	}
} satisfies import('./$types').Actions;
