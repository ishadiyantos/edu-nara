import { fail, error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { database } from '$lib/server/db/client';
import { activities } from '$lib/server/db/schema';
import { body, message, requireAdmin } from '$lib/server/http';
import {
	createChoiceQuestion,
	getChoiceQuestionsByActivity,
	setChoiceCorrectOptions,
	updateChoiceQuestion
} from '$lib/server/poll/choice';
export const load: import('./$types').PageServerLoad = (event) => {
	const owner = requireAdmin(event);
	const store = database();
	const activity = store.db
		.select()
		.from(activities)
		.where(
			and(
				eq(activities.id, event.params.id),
				eq(activities.ownerId, owner),
				eq(activities.type, 'choice')
			)
		)
		.get();
	if (!activity) error(404, 'Aktivitas tidak ditemukan.');
	return { activity, questions: getChoiceQuestionsByActivity(store, activity.id) };
};
export const actions = {
	addQuestion: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			const options = [data.optionA, data.optionB, data.optionC, data.optionD]
				.map((value) => String(value ?? '').trim())
				.filter(Boolean);
			const question = createChoiceQuestion(database(), owner, event.params.id, {
				prompt: data.prompt,
				options,
				correctOptions: [0, 1, 2, 3].filter((index) => data[`correct${index}`] === 'on'),
				timeLimit: data.timeLimit
			});
			return { ok: true, message: `Pertanyaan ${question.position + 1} tersimpan.` };
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	},
	setCorrect: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			const optionIds = [0, 1, 2, 3]
				.map((index) => data[`option${index}`])
				.filter((value): value is string => typeof value === 'string');
			setChoiceCorrectOptions(database(), owner, String(data.questionId), optionIds);
			return { ok: true, message: 'Jawaban benar diperbarui.' };
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	},
	editQuestion: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			const options = [data.optionA, data.optionB, data.optionC, data.optionD]
				.map((value) => String(value ?? '').trim())
				.filter(Boolean);
			updateChoiceQuestion(database(), owner, String(data.questionId), {
				prompt: data.prompt,
				options,
				correctOptions: [0, 1, 2, 3].filter((index) => data[`correct${index}`] === 'on'),
				timeLimit: data.timeLimit
			});
			return { ok: true, message: 'Pertanyaan diperbarui.' };
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	}
} satisfies import('./$types').Actions;
