import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, isNull, max } from 'drizzle-orm';
import type { Store } from '../db/client';
import {
	activities,
	participants,
	pollQuestions,
	sessions,
	wordcloudResponses
} from '../db/schema';
import { hashToken } from '../auth';
import { UserError } from '../errors';
import { wordcloudQuestionSchema } from '../../poll/validation';
import { events } from '../events';
import { ownedSession } from '../sessions';

export type WordcloudStatus = 'pending' | 'approved' | 'rejected';

export function normalizeWordcloudText(raw: string) {
	const word = raw.normalize('NFC').trim().toLowerCase().replace(/\s+/gu, ' ').normalize('NFC');
	if (!word || [...word].length > 80 || /[\p{Cc}\p{Cf}]/u.test(raw))
		throw new UserError('Invalid word or phrase.');
	return word;
}

function nextPosition(store: Store, activityId: string) {
	const row = store.db
		.select({ position: max(pollQuestions.position) })
		.from(pollQuestions)
		.where(eq(pollQuestions.activityId, activityId))
		.get();
	return row?.position == null ? 0 : Number(row.position) + 1;
}

function ownedActivity(store: Store, ownerId: string, activityId: string) {
	const activity = store.db
		.select({ id: activities.id })
		.from(activities)
		.where(
			and(
				eq(activities.id, activityId),
				eq(activities.ownerId, ownerId),
				eq(activities.type, 'wordcloud')
			)
		)
		.get();
	if (!activity) throw new UserError('Word Cloud activity not found.');
	return activity;
}

function participantFor(store: Store, sessionId: string, token: string) {
	return store.db
		.select({ participant: participants, session: sessions, activity: activities })
		.from(participants)
		.innerJoin(sessions, eq(sessions.id, participants.sessionId))
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(
			and(
				eq(participants.sessionId, sessionId),
				eq(participants.tokenHash, hashToken(token)),
				gt(participants.expiresAt, Date.now())
			)
		)
		.get();
}

export function createWordcloudQuestion(
	store: Store,
	ownerId: string,
	activityId: string,
	input: unknown
) {
	const data = wordcloudQuestionSchema.parse(input);
	ownedActivity(store, ownerId, activityId);
	const row = {
		id: randomUUID(),
		activityId,
		prompt: data.prompt,
		position: nextPosition(store, activityId),
		showResults: false,
		timeLimit: 20,
		kind: 'wordcloud' as const,
		wordLimit: data.wordLimit,
		moderationEnabled: data.moderationEnabled,
		createdAt: Date.now()
	};
	store.db.insert(pollQuestions).values(row).run();
	// Any already-launched session for this activity should point at the first
	// question if it hasn't picked one yet.
	store.db
		.update(sessions)
		.set({ activeQuestionId: row.id })
		.where(and(eq(sessions.activityId, activityId), isNull(sessions.activeQuestionId)))
		.run();
	return row;
}

export function getWordcloudQuestionsByActivity(store: Store, activityId: string) {
	return store.db
		.select()
		.from(pollQuestions)
		.where(and(eq(pollQuestions.activityId, activityId), eq(pollQuestions.kind, 'wordcloud')))
		.orderBy(asc(pollQuestions.position))
		.all();
}

export function getWordcloudQuestionByActivity(store: Store, activityId: string) {
	return getWordcloudQuestionsByActivity(store, activityId)[0] ?? null;
}

export function activeQuestionId(store: Store, sessionId: string) {
	const row = store.db
		.select({ activeQuestionId: sessions.activeQuestionId, activityId: sessions.activityId })
		.from(sessions)
		.where(eq(sessions.id, sessionId))
		.get();
	if (!row) throw new UserError('Session not found.');
	return (
		row.activeQuestionId ?? getWordcloudQuestionsByActivity(store, row.activityId)[0]?.id ?? null
	);
}

export function advanceActiveQuestion(
	store: Store,
	ownerId: string,
	sessionId: string,
	direction: number
) {
	if (direction !== 1 && direction !== -1) throw new UserError('Invalid navigation direction.');
	const current = ownedSession(store, ownerId, sessionId);
	ownedActivity(store, ownerId, current.activityId);
	const questions = getWordcloudQuestionsByActivity(store, current.activityId);
	const index = questions.findIndex(
		(question) => question.id === (current.activeQuestionId ?? questions[0]?.id)
	);
	const next = questions[Math.min(questions.length - 1, Math.max(0, index + direction))];
	if (!next || next.id === current.activeQuestionId) return current.activeQuestionId ?? null;
	store.db
		.update(sessions)
		.set({ activeQuestionId: next.id })
		.where(eq(sessions.id, sessionId))
		.run();
	events.publish(sessionId, 'session.question', { questionId: next.id });
	return next.id;
}

export function setActiveQuestion(
	store: Store,
	ownerId: string,
	sessionId: string,
	questionId: string
) {
	const current = ownedSession(store, ownerId, sessionId);
	ownedActivity(store, ownerId, current.activityId);
	const questions = getWordcloudQuestionsByActivity(store, current.activityId);
	if (!questions.some((question) => question.id === questionId))
		throw new UserError('Question not found.');
	if (current.activeQuestionId === questionId) return questionId;
	store.db
		.update(sessions)
		.set({ activeQuestionId: questionId })
		.where(eq(sessions.id, sessionId))
		.run();
	events.publish(sessionId, 'session.question', { questionId });
	return questionId;
}

export function updateWordcloudQuestion(
	store: Store,
	ownerId: string,
	questionId: string,
	input: unknown
) {
	const data = wordcloudQuestionSchema.parse(input);
	const row = store.db
		.select({ question: pollQuestions })
		.from(pollQuestions)
		.innerJoin(activities, eq(activities.id, pollQuestions.activityId))
		.where(
			and(
				eq(pollQuestions.id, questionId),
				eq(activities.ownerId, ownerId),
				eq(activities.type, 'wordcloud')
			)
		)
		.get();
	if (!row || row.question.kind !== 'wordcloud') throw new UserError('Question not found.');
	return store.db
		.update(pollQuestions)
		.set({
			prompt: data.prompt,
			wordLimit: data.wordLimit,
			moderationEnabled: data.moderationEnabled
		})
		.where(eq(pollQuestions.id, questionId))
		.returning()
		.get()!;
}

export function setWordcloudResults(
	store: Store,
	ownerId: string,
	questionId: string,
	showResults: boolean
) {
	const row = store.db
		.select({ question: pollQuestions })
		.from(pollQuestions)
		.innerJoin(activities, eq(activities.id, pollQuestions.activityId))
		.where(
			and(
				eq(pollQuestions.id, questionId),
				eq(activities.ownerId, ownerId),
				eq(pollQuestions.kind, 'wordcloud')
			)
		)
		.get();
	if (!row) throw new UserError('Question not found.');
	return store.db
		.update(pollQuestions)
		.set({ showResults })
		.where(eq(pollQuestions.id, questionId))
		.returning()
		.get()!;
}

export function wordcloudSnapshot(store: Store, sessionId: string, questionId: string) {
	return store.sqlite
		.prepare(
			`SELECT word, COUNT(*) AS weight FROM wordcloud_responses WHERE session_id = ? AND question_id = ? AND status = 'approved' GROUP BY word ORDER BY weight DESC, word COLLATE NOCASE ASC`
		)
		.all(sessionId, questionId)
		.map((row) => ({
			word: String((row as { word: string }).word),
			weight: Number((row as { weight: number }).weight)
		}));
}

const lastPublished = new Map<string, number>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();
export function publishWordcloudSnapshot(store: Store, sessionId: string, questionId: string) {
	const key = `${sessionId}:${questionId}`;
	const publish = () => {
		pending.delete(key);
		if (!store.sqlite.open) return null;
		lastPublished.set(key, Date.now());
		return events.publish(sessionId, 'wordcloud.snapshot', {
			questionId,
			words: wordcloudSnapshot(store, sessionId, questionId)
		});
	};
	const wait = Math.max(0, 500 - (Date.now() - (lastPublished.get(key) ?? 0)));
	if (!wait) return publish();
	if (!pending.has(key)) pending.set(key, setTimeout(publish, wait));
	return null;
}

export function submitWordcloudResponse(
	store: Store,
	sessionId: string,
	questionId: string,
	token: string,
	rawWord: string
) {
	const word = normalizeWordcloudText(rawWord);
	const result = store.sqlite
		.transaction(() => {
			const auth = participantFor(store, sessionId, token);
			if (!auth || auth.session.state !== 'open' || auth.activity.type !== 'wordcloud')
				throw new UserError('Session is not accepting answers.');
			const question = store.db
				.select()
				.from(pollQuestions)
				.where(
					and(
						eq(pollQuestions.id, questionId),
						eq(pollQuestions.activityId, auth.session.activityId),
						eq(pollQuestions.kind, 'wordcloud')
					)
				)
				.get();
			if (!question) throw new UserError('Question not available.');
			if (activeQuestionId(store, sessionId) !== questionId)
				throw new UserError('Question is not active yet.');
			const existing = store.db
				.select()
				.from(wordcloudResponses)
				.where(
					and(
						eq(wordcloudResponses.questionId, questionId),
						eq(wordcloudResponses.sessionId, sessionId),
						eq(wordcloudResponses.participantId, auth.participant.id),
						eq(wordcloudResponses.word, word)
					)
				)
				.get();
			if (existing)
				return { row: existing, alreadySubmitted: true, approved: existing.status === 'approved' };
			const count = store.sqlite
				.prepare(
					'SELECT COUNT(*) AS n FROM wordcloud_responses WHERE question_id = ? AND session_id = ? AND participant_id = ?'
				)
				.get(questionId, sessionId, auth.participant.id) as { n: number };
			if (Number(count.n) >= question.wordLimit)
				throw new UserError('Submission limit reached for this question.');
			const row = {
				id: randomUUID(),
				questionId,
				sessionId,
				participantId: auth.participant.id,
				word,
				status: (question.moderationEnabled ? 'pending' : 'approved') as WordcloudStatus,
				createdAt: Date.now()
			};
			store.db.insert(wordcloudResponses).values(row).run();
			return { row, alreadySubmitted: false, approved: row.status === 'approved' };
		})
		.immediate();
	return {
		...result,
		lastEventId:
			result.approved && !result.alreadySubmitted
				? publishWordcloudSnapshot(store, sessionId, questionId)
				: null
	};
}

export function participantWordcloudResponses(store: Store, sessionId: string, token: string) {
	const auth = participantFor(store, sessionId, token);
	if (!auth) return [];
	return store.db
		.select({
			questionId: wordcloudResponses.questionId,
			word: wordcloudResponses.word,
			status: wordcloudResponses.status
		})
		.from(wordcloudResponses)
		.where(
			and(
				eq(wordcloudResponses.sessionId, sessionId),
				eq(wordcloudResponses.participantId, auth.participant.id)
			)
		)
		.orderBy(asc(wordcloudResponses.createdAt))
		.all();
}

export function moderationQueue(
	store: Store,
	ownerId: string,
	sessionId: string,
	questionId: string
) {
	const owned = store.db
		.select({ id: sessions.id })
		.from(sessions)
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(
			and(
				eq(sessions.id, sessionId),
				eq(activities.ownerId, ownerId),
				eq(activities.type, 'wordcloud')
			)
		)
		.get();
	if (!owned) throw new UserError('Session not found.');
	return store.db
		.select({
			id: wordcloudResponses.id,
			word: wordcloudResponses.word,
			status: wordcloudResponses.status,
			createdAt: wordcloudResponses.createdAt
		})
		.from(wordcloudResponses)
		.where(
			and(
				eq(wordcloudResponses.sessionId, sessionId),
				eq(wordcloudResponses.questionId, questionId)
			)
		)
		.orderBy(asc(wordcloudResponses.createdAt))
		.all();
}

export function moderateWordcloudResponse(
	store: Store,
	ownerId: string,
	responseId: string,
	status: WordcloudStatus
) {
	if (status !== 'approved' && status !== 'rejected')
		throw new UserError('Invalid moderation status.');
	const row = store.db
		.select({ response: wordcloudResponses })
		.from(wordcloudResponses)
		.innerJoin(sessions, eq(sessions.id, wordcloudResponses.sessionId))
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(
			and(
				eq(wordcloudResponses.id, responseId),
				eq(activities.ownerId, ownerId),
				eq(activities.type, 'wordcloud')
			)
		)
		.get();
	if (!row) throw new UserError('Submission not found.');
	// Drop published snapshots so a reconnecting client cannot replay a withdrawn word.
	events.clear(row.response.sessionId);
	const updated = store.db
		.update(wordcloudResponses)
		.set({ status })
		.where(eq(wordcloudResponses.id, responseId))
		.returning()
		.get()!;
	return {
		...updated,
		lastEventId: publishWordcloudSnapshot(store, updated.sessionId, updated.questionId)
	};
}
