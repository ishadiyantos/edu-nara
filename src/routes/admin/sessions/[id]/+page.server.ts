import { error, fail } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { ownedSession, snapshot, changeState } from '$lib/server/sessions';
import { body, message, requireAdmin } from '$lib/server/http';
import { events } from '$lib/server/events';
import {
	getChoiceQuestionsByActivity,
	quizLeaderboard,
	setChoiceResults
} from '$lib/server/poll/choice';
export const load: import('./$types').PageServerLoad = (event) => {
	try {
		const store = database();
		const owner = requireAdmin(event);
		const session = ownedSession(store, owner, event.params.id);
		const questions = getChoiceQuestionsByActivity(store, session.activityId);
		const current = snapshot(store, event.params.id);
		return {
			snapshot: current,
			joinUrl: `${event.url.origin}/join?code=${current.code}`,
			questions: questions.map(({ id, prompt, position, timeLimit, showResults, options }) => ({
				id,
				prompt,
				position,
				timeLimit,
				showResults,
				options: options.map(({ id, label }) => ({ id, label }))
			})),
			leaderboard: current.state === 'ended' ? quizLeaderboard(store, session.id) : []
		};
	} catch {
		error(404, 'Sesi tidak ditemukan.');
	}
};
export const actions = {
	default: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			if (data.action === 'results') {
				const questionId = String(data.questionId);
				const row = setChoiceResults(
					database(),
					owner,
					questionId,
					String(data.showResults) === 'true'
				);
				const session = ownedSession(database(), owner, event.params.id);
				if (!row.showResults) events.clear(session.id);
				const lastEventId = events.publish(session.id, 'session.state', {
					showResults: row.showResults
				});
				return {
					ok: true,
					lastEventId,
					message: row.showResults ? 'Hasil dibuka untuk mahasiswa.' : 'Hasil disembunyikan.'
				};
			}
			const row = changeState(database(), owner, event.params.id, data.state);
			const lastEventId = events.publish(row.id, 'session.state', { state: row.state });
			return { ok: true, lastEventId };
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	}
} satisfies import('./$types').Actions;
