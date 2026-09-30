import { listBoard } from '$lib/server/board';
import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { database } from '$lib/server/db/client';
import { activities, pollQuestions } from '$lib/server/db/schema';
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
		if (activity.type === 'board')
			return {
				snapshot: current,
				activityType: activity.type,
				questions: [],
				words: [],
				moderation: [],
				leaderboard: [],
				joinUrl: `${event.url.origin}/join?code=${current.code}`,
				board: listBoard(store, session.id, owner),
				activityId: activity.id
			};
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
			quizMode: current.quizMode,
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
			leaderboard: quizLeaderboard(store, session.id)
		};
	} catch {
		error(404, 'Session not found.');
	}
};

export const actions = {
	default: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			const store = database();
			const session = ownedSession(store, owner, event.params.id);
			const activity = store.db
				.select()
				.from(activities)
				.where(eq(activities.id, session.activityId))
				.get()!;
			if (data.action === 'results') {
				const questionId = String(data.questionId);
				const question = store.db
					.select()
					.from(pollQuestions)
					.where(eq(pollQuestions.id, questionId))
					.get();
				if (!question || question.activityId !== session.activityId)
					throw new Error('Question does not belong to this session.');
				if (!['true', 'false'].includes(String(data.showResults)))
					throw new Error('Invalid results state.');
				const row =
					activity?.type === 'wordcloud'
						? setWordcloudResults(store, owner, questionId, String(data.showResults) === 'true')
						: setChoiceResults(store, owner, questionId, String(data.showResults) === 'true');
				if (!row.showResults) events.clear(session.id);
				return {
					ok: true,
					lastEventId: events.publish(session.id, 'session.state', {
						...snapshot(store, session.id),
						questionId,
						showResults: row.showResults
					}),
					message: row.showResults ? 'Results shown.' : 'Results hidden.'
				};
			}
			if (data.action === 'question') {
				const direction = Number(data.direction);
				if (activity.type === 'choice') {
					const { advanceActiveChoiceQuestion, setActiveChoiceQuestion } =
						await import('$lib/server/poll/choice');
					const questionId =
						data.questionId != null && data.questionId !== ''
							? setActiveChoiceQuestion(store, owner, event.params.id, String(data.questionId))
							: advanceActiveChoiceQuestion(store, owner, event.params.id, direction);
					const row = ownedSession(store, owner, event.params.id);
					const lastEventId = events.publish(row.id, 'session.question', snapshot(store, row.id));
					return {
						ok: true,
						lastEventId,
						message: questionId ? undefined : 'No other questions.'
					};
				}
				const { advanceActiveQuestion, setActiveQuestion } =
					await import('$lib/server/poll/wordcloud');
				const questionId =
					data.questionId != null && data.questionId !== ''
						? setActiveQuestion(store, owner, event.params.id, String(data.questionId))
						: advanceActiveQuestion(store, owner, event.params.id, direction);
				return { ok: true, message: questionId ? undefined : 'No other questions.' };
			}
			if (data.action === 'timer') {
				const { setChoiceTimer } = await import('$lib/server/poll/choice');
				if (
					!['true', 'false'].includes(String(data.running)) ||
					(data.reset != null && !['true', 'false'].includes(String(data.reset)))
				)
					throw new Error('Invalid timer.');
				const row = setChoiceTimer(store, owner, event.params.id, {
					questionId: String(data.questionId ?? ''),
					running: String(data.running) === 'true',
					duration: data.duration ? Number(data.duration) : undefined,
					reset: String(data.reset) === 'true'
				});
				return {
					ok: true,
					timer: row,
					lastEventId: events.publish(
						event.params.id,
						'session.state',
						snapshot(store, event.params.id)
					)
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
				return { ok: true, lastEventId: row.lastEventId, message: 'Moderation updated.' };
			}
			const row = changeState(store, owner, event.params.id, data.state);
			return {
				ok: true,
				lastEventId: events.publish(row.id, 'session.state', snapshot(store, row.id))
			};
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	}
} satisfies import('./$types').Actions;
