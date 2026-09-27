import { error } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { authorizeSession, sessionByCode, snapshot } from '$lib/server/sessions';
import { getChoiceQuestionsByActivity, participantChoiceResponses } from '$lib/server/poll/choice';
export const load: import('./$types').PageServerLoad = ({ params, cookies, locals }) => {
	const store = database();
	const session = sessionByCode(store, params.sessionCode);
	if (
		!session ||
		!authorizeSession(store, session.id, locals.admin?.id, cookies.get(`edu_p_${session.id}`))
	)
		error(401, 'Bergabung melalui kode sesi terlebih dahulu.');
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
	const token = cookies.get(`edu_p_${session.id}`);
	const responses = token ? participantChoiceResponses(store, session.id, token) : [];
	return {
		snapshot: snapshot(store, session.id),
		questions,
		responses,
		initialScore: responses.reduce((total, response) => total + (response.points ?? 0), 0)
	};
};
