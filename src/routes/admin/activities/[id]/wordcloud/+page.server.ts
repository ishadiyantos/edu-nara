import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { database } from '$lib/server/db/client';
import { activities } from '$lib/server/db/schema';
import { body, message, requireAdmin } from '$lib/server/http';
import {
	createWordcloudQuestion,
	getWordcloudQuestionByActivity,
	updateWordcloudQuestion
} from '$lib/server/poll/wordcloud';
export const load: import('./$types').PageServerLoad = (event) => {
	const store = database();
	const owner = requireAdmin(event);
	const activity = store.db
		.select()
		.from(activities)
		.where(
			and(
				eq(activities.id, event.params.id),
				eq(activities.ownerId, owner),
				eq(activities.type, 'wordcloud')
			)
		)
		.get();
	if (!activity) error(404, 'Aktivitas tidak ditemukan.');
	return { activity, question: getWordcloudQuestionByActivity(store, activity.id) };
};
export const actions = {
	default: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			const input = {
				prompt: data.prompt,
				wordLimit: data.wordLimit,
				moderationEnabled: data.moderationEnabled === 'on'
			};
			const store = database();
			const question = getWordcloudQuestionByActivity(store, event.params.id);
			if (question) updateWordcloudQuestion(store, owner, question.id, input);
			else createWordcloudQuestion(store, owner, event.params.id, input);
			return { message: 'Word Cloud tersimpan.' };
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	}
} satisfies import('./$types').Actions;
