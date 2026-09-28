import { error } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { authorizeSession, sessionByCode, snapshot } from '$lib/server/sessions';
import { activities } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getChoiceQuestionsByActivity, participantChoiceResponses } from '$lib/server/poll/choice';
import {
	getWordcloudQuestionsByActivity,
	participantWordcloudResponses
} from '$lib/server/poll/wordcloud';
export const load: import('./$types').PageServerLoad = ({ params, cookies, locals }) => {
	const store = database();
	const session = sessionByCode(store, params.sessionCode);
	if (
		!session ||
		!authorizeSession(store, session.id, locals.admin?.id, cookies.get(`edu_p_${session.id}`))
	)
		error(401, 'Bergabung melalui kode sesi terlebih dahulu.');
	const current = snapshot(store, session.id);
	const activityType = store.db
		.select({ type: activities.type })
		.from(activities)
		.where(eq(activities.id, session.activityId))
		.get()!.type;
	const token = cookies.get(`edu_p_${session.id}`);
	if (session.state === 'draft')
		return {
			snapshot: current,
			activityType,
			quizMode: current.quizMode,
			questions: [],
			responses: [],
			initialScore: 0
		};
	if (activityType === 'wordcloud') {
		const questions = getWordcloudQuestionsByActivity(store, session.activityId).map(
			({ id, prompt, position, showResults, timeLimit, wordLimit }) => ({
				id,
				prompt,
				position,
				showResults,
				timeLimit,
				wordLimit
			})
		);
		const responses = token ? participantWordcloudResponses(store, session.id, token) : [];
		return { snapshot: current, activityType, questions, responses, initialScore: 0 };
	}
	const questions = getChoiceQuestionsByActivity(store, session.activityId).map(
		({ id, prompt, position, showResults, timeLimit, options }) => ({
			id,
			prompt,
			position,
			showResults,
			timeLimit,
			options: options.map(({ id, label, position }) => ({ id, label, position }))
		})
	);
	const responses = token ? participantChoiceResponses(store, session.id, token) : [];
	return {
		snapshot: current,
		activityType,
		quizMode: current.quizMode,
		questions,
		responses,
		initialScore: responses.reduce((total, response) => total + (response.points ?? 0), 0)
	};
};
