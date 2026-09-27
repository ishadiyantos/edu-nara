import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { database } from '$lib/server/db/client';
import { activities, sessions } from '$lib/server/db/schema';
import { ownedSession, snapshot, changeState } from '$lib/server/sessions';
import { body, message, requireAdmin } from '$lib/server/http';
import { events } from '$lib/server/events';
import {
	getChoiceQuestionsByActivity,
	quizLeaderboard,
	setChoiceResults
} from '$lib/server/poll/choice';
import {
	getWordcloudQuestionsByActivity,
	moderationQueue,
	setWordcloudResults,
	wordcloudSnapshot
} from '$lib/server/poll/wordcloud';

export const load: import('./$types').PageServerLoad = (event) => {
	try {
		const store = database();
		const owner = requireAdmin(event);
		const session = ownedSession(store, owner, event.params.id);
		const activity = store.db
			.select()
			.from(activities)
			.where(eq(activities.id, session.activityId))
			.get()!;
		const current = snapshot(store, event.params.id);
		if (activity.type === 'wordcloud') {
			const questions = getWordcloudQuestionsByActivity(store, session.activityId);
			return {
				snapshot: current,
				activityType: activity.type,
				questions: questions.map(({ id, prompt, position, showResults, wordLimit }) => ({
					id,
					prompt,
					position,
					showResults,
					wordLimit
				})),
				words: questions[0] ? wordcloudSnapshot(store, session.id, questions[0].id) : [],
				moderation: questions[0] ? moderationQueue(store, owner, session.id, questions[0].id) : [],
				joinUrl: `${event.url.origin}/join?code=${current.code}`,
				leaderboard: []
			};
		}
		const questions = getChoiceQuestionsByActivity(store, session.activityId);
		return {
			snapshot: current,
			activityType: activity.type,
			questions: questions.map(({ id, prompt, position, timeLimit, showResults, options }) => ({
				id,
				prompt,
				position,
				timeLimit,
				showResults,
				options: options.map(({ id, label }) => ({ id, label }))
			})),
			words: [],
			moderation: [],
			joinUrl: `${event.url.origin}/join?code=${current.code}`,
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
			const store = database();
			if (data.action === 'results') {
				const questionId = String(data.questionId);
				const activity = store.db
					.select({ type: activities.type })
					.from(activities)
					.innerJoin(sessions, eq(sessions.activityId, activities.id))
					.where(and(eq(sessions.id, event.params.id), eq(activities.ownerId, owner)))
					.get();
				const row =
					activity?.type === 'wordcloud'
						? setWordcloudResults(store, owner, questionId, String(data.showResults) === 'true')
						: setChoiceResults(store, owner, questionId, String(data.showResults) === 'true');
				const session = ownedSession(store, owner, event.params.id);
				if (!row.showResults) events.clear(session.id);
				return {
					ok: true,
					lastEventId: events.publish(session.id, 'session.state', {
						showResults: row.showResults
					}),
					message: row.showResults ? 'Hasil dibuka.' : 'Hasil disembunyikan.'
				};
			}
			if (data.action === 'moderate') {
				const { moderateWordcloudResponse } = await import('$lib/server/poll/wordcloud');
				const row = moderateWordcloudResponse(
					store,
					owner,
					String(data.responseId),
					String(data.status) as 'approved' | 'rejected'
				);
				return { ok: true, lastEventId: row.lastEventId, message: 'Moderasi diperbarui.' };
			}
			const row = changeState(store, owner, event.params.id, data.state);
			return {
				ok: true,
				lastEventId: events.publish(row.id, 'session.state', { state: row.state })
			};
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	}
} satisfies import('./$types').Actions;
