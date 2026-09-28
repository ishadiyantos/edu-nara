import { and, asc, eq, gt, max, sum } from 'drizzle-orm';
import type { Store } from '../db/client';
import {
	activities,
	participants,
	pollOptions,
	pollQuestions,
	pollResponseOptions,
	pollResponses,
	sessions
} from '../db/schema';
import { hashToken } from '../auth';
import { choiceQuestionSchema } from '../../poll/validation';
import { UserError } from '../errors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

function nextPosition(store: Store, activityId: string) {
	const row = store.db
		.select({ position: max(pollQuestions.position) })
		.from(pollQuestions)
		.where(eq(pollQuestions.activityId, activityId))
		.get();
	return row?.position == null ? 0 : Number(row.position) + 1;
}

export function createChoiceQuestion(
	store: Store,
	ownerId: string,
	activityId: string,
	input: unknown
) {
	const data = choiceQuestionSchema.parse(input);
	const activity = store.db
		.select({ id: activities.id })
		.from(activities)
		.where(
			and(
				eq(activities.id, activityId),
				eq(activities.ownerId, ownerId),
				eq(activities.type, 'choice')
			)
		)
		.get();
	if (!activity) throw new UserError('Aktivitas Quiz tidak ditemukan.');
	const questionId = randomUUID();
	const position = nextPosition(store, activityId);
	const now = Date.now();
	store.db.transaction((tx) => {
		tx.insert(pollQuestions)
			.values({
				id: questionId,
				activityId,
				prompt: data.prompt,
				position,
				timeLimit: data.timeLimit,
				createdAt: now
			})
			.run();
		const ids = data.options.map(() => randomUUID());
		tx.insert(pollOptions)
			.values(
				data.options.map((label, optionPosition) => ({
					id: ids[optionPosition],
					questionId,
					label,
					position: optionPosition,
					isCorrect: data.correctOptions.includes(optionPosition)
				}))
			)
			.run();
	});
	return getChoiceQuestion(store, questionId)!;
}

export function getChoiceQuestion(store: Store, questionId: string) {
	const question = store.db
		.select()
		.from(pollQuestions)
		.where(and(eq(pollQuestions.id, questionId), eq(pollQuestions.kind, 'choice')))
		.get();
	if (!question) return null;
	return {
		...question,
		options: store.db
			.select()
			.from(pollOptions)
			.where(eq(pollOptions.questionId, questionId))
			.orderBy(asc(pollOptions.position))
			.all()
	};
}

export function getChoiceQuestionsByActivity(store: Store, activityId: string) {
	return store.db
		.select()
		.from(pollQuestions)
		.where(and(eq(pollQuestions.activityId, activityId), eq(pollQuestions.kind, 'choice')))
		.orderBy(asc(pollQuestions.position))
		.all()
		.map((question) => getChoiceQuestion(store, question.id)!);
}

export function getChoiceQuestionByActivity(store: Store, activityId: string) {
	return getChoiceQuestionsByActivity(store, activityId)[0] ?? null;
}

export function setActiveChoiceQuestion(
	store: Store,
	ownerId: string,
	sessionId: string,
	questionId: string
) {
	const session = ownedChoiceSession(store, ownerId, sessionId);
	const question = getChoiceQuestion(store, questionId);
	if (!question || question.activityId !== session.activityId)
		throw new UserError('Pertanyaan tidak tersedia untuk sesi ini.');
	if (
		session.activeQuestionId !== questionId ||
		(session.timerDeadline == null && session.timerDuration === 0)
	) {
		const autoDuration =
			session.quizMode === 'guided' && session.state === 'open' ? question.timeLimit * 1000 : 0;
		store.db
			.update(sessions)
			.set({
				activeQuestionId: questionId,
				timerDeadline: autoDuration ? Date.now() + autoDuration : null,
				timerDuration: autoDuration
			})
			.where(eq(sessions.id, sessionId))
			.run();
	}
	return questionId;
}

export function advanceActiveChoiceQuestion(
	store: Store,
	ownerId: string,
	sessionId: string,
	direction: number
) {
	const session = ownedChoiceSession(store, ownerId, sessionId);
	if (!Number.isInteger(direction) || ![-1, 1].includes(direction))
		throw new UserError('Arah soal tidak valid.');
	const questions = getChoiceQuestionsByActivity(store, session.activityId);
	const current = Math.max(
		0,
		questions.findIndex((question) => question.id === session.activeQuestionId)
	);
	const next = questions[Math.max(0, Math.min(questions.length - 1, current + direction))];
	return next ? setActiveChoiceQuestion(store, ownerId, sessionId, next.id) : null;
}

export function setChoiceTimer(store: Store, ownerId: string, sessionId: string, input: unknown) {
	const data = z
		.object({
			questionId: z.string().min(1),
			running: z.boolean(),
			duration: z.number().int().min(1).max(3600).optional(),
			reset: z.boolean().optional()
		})
		.strict()
		.parse(input);
	const session = ownedChoiceSession(store, ownerId, sessionId);
	const questionId = data.questionId ?? session.activeQuestionId;
	const question = questionId ? getChoiceQuestion(store, questionId) : null;
	if (
		!question ||
		question.activityId !== session.activityId ||
		session.activeQuestionId !== question.id
	)
		throw new UserError('Soal timer sudah berubah.');
	if (session.state !== 'open') throw new UserError('Buka sesi sebelum mengatur timer.');
	const now = Date.now();
	const expired = session.timerDeadline != null && session.timerDeadline <= now;
	// Keep an expired deadline: null + zero represents an untimed question.
	if (expired && !data.reset) {
		if (data.running) throw new UserError('Timer habis. Reset timer untuk memulai lagi.');
		return timerState(store, sessionId);
	}
	if (data.running && session.timerDeadline && !data.reset) return timerState(store, sessionId);
	const remaining =
		session.timerDeadline == null
			? session.timerDuration
			: Math.max(0, session.timerDeadline - now);
	const duration =
		data.reset || remaining === 0 ? (data.duration ?? question.timeLimit) * 1000 : remaining;
	store.db
		.update(sessions)
		.set({
			timerDeadline: data.running ? now + duration : null,
			timerDuration: duration
		})
		.where(eq(sessions.id, sessionId))
		.run();
	return timerState(store, sessionId);
}

function ownedChoiceSession(store: Store, ownerId: string, sessionId: string) {
	const session = store.db
		.select({ session: sessions, ownerId: activities.ownerId })
		.from(sessions)
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(
			and(
				eq(sessions.id, sessionId),
				eq(activities.ownerId, ownerId),
				eq(activities.type, 'choice')
			)
		)
		.get()?.session;
	if (!session) throw new UserError('Sesi Quiz tidak ditemukan.');
	if (session.quizMode !== 'guided') throw new UserError('Kontrol ini hanya untuk mode terpandu.');
	return session;
}

export function updateChoiceQuestion(
	store: Store,
	ownerId: string,
	questionId: string,
	input: unknown
) {
	const data = choiceQuestionSchema.parse(input);
	const row = store.db
		.select({ question: pollQuestions })
		.from(pollQuestions)
		.innerJoin(activities, eq(activities.id, pollQuestions.activityId))
		.where(
			and(
				eq(pollQuestions.id, questionId),
				eq(activities.ownerId, ownerId),
				eq(pollQuestions.kind, 'choice')
			)
		)
		.get();
	if (!row) throw new UserError('Pertanyaan tidak ditemukan.');
	const currentOptions = store.db
		.select()
		.from(pollOptions)
		.where(eq(pollOptions.questionId, questionId))
		.orderBy(asc(pollOptions.position))
		.all();
	if (currentOptions.length !== data.options.length)
		throw new UserError('Jumlah opsi tidak dapat diubah setelah pertanyaan dibuat.');
	store.db.transaction((tx) => {
		tx.update(pollQuestions)
			.set({ prompt: data.prompt, timeLimit: data.timeLimit })
			.where(eq(pollQuestions.id, questionId))
			.run();
		currentOptions.forEach((option, index) => {
			tx.update(pollOptions)
				.set({ label: data.options[index], isCorrect: data.correctOptions.includes(index) })
				.where(eq(pollOptions.id, option.id))
				.run();
		});
	});
	return getChoiceQuestion(store, questionId)!;
}

export function setChoiceCorrectOptions(
	store: Store,
	ownerId: string,
	questionId: string,
	optionIds: string[]
) {
	const row = store.db
		.select({ question: pollQuestions })
		.from(pollQuestions)
		.innerJoin(activities, eq(activities.id, pollQuestions.activityId))
		.where(
			and(
				eq(pollQuestions.id, questionId),
				eq(activities.ownerId, ownerId),
				eq(pollQuestions.kind, 'choice')
			)
		)
		.get();
	const uniqueIds = [...new Set(optionIds)];
	const valid = store.db
		.select({ id: pollOptions.id })
		.from(pollOptions)
		.where(eq(pollOptions.questionId, questionId))
		.all()
		.map((option) => option.id);
	if (!row || uniqueIds.length === 0 || uniqueIds.some((id) => !valid.includes(id)))
		throw new UserError('Pilih minimal satu jawaban benar dari pertanyaan ini.');
	store.db.transaction((tx) => {
		tx.update(pollOptions)
			.set({ isCorrect: false })
			.where(eq(pollOptions.questionId, questionId))
			.run();
		for (const optionId of uniqueIds)
			tx.update(pollOptions).set({ isCorrect: true }).where(eq(pollOptions.id, optionId)).run();
	});
}

export function setChoiceResults(
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
				eq(pollQuestions.kind, 'choice')
			)
		)
		.get();
	if (!row) throw new UserError('Pertanyaan tidak ditemukan.');
	return store.db
		.update(pollQuestions)
		.set({ showResults })
		.where(eq(pollQuestions.id, questionId))
		.returning()
		.get()!;
}

function timerState(store: Store, sessionId: string) {
	const row = store.db
		.select({ timerDeadline: sessions.timerDeadline, timerDuration: sessions.timerDuration })
		.from(sessions)
		.where(eq(sessions.id, sessionId))
		.get();
	const now = Date.now();
	return {
		timerDeadline: row?.timerDeadline ?? null,
		timerDuration: row?.timerDuration ?? 0,
		serverNow: now,
		timerRunning: row?.timerDeadline != null && row.timerDeadline > now
	};
}

function participantFor(store: Store, sessionId: string, token: string) {
	return store.db
		.select({ participant: participants, session: sessions })
		.from(participants)
		.innerJoin(sessions, eq(sessions.id, participants.sessionId))
		.where(
			and(
				eq(participants.sessionId, sessionId),
				eq(participants.tokenHash, hashToken(token)),
				gt(participants.expiresAt, Date.now())
			)
		)
		.get();
}

export function participantChoiceResponses(store: Store, sessionId: string, token: string) {
	const auth = participantFor(store, sessionId, token);
	if (!auth) return [];
	return store.db
		.select({ questionId: pollResponses.questionId, responseId: pollResponses.id })
		.from(pollResponses)
		.where(eq(pollResponses.participantId, auth.participant.id))
		.all()
		.map(({ questionId, responseId }) => {
			const question = getChoiceQuestion(store, questionId);
			const response = store.db
				.select({ isCorrect: pollResponses.isCorrect, points: pollResponses.points })
				.from(pollResponses)
				.where(eq(pollResponses.id, responseId))
				.get();
			return {
				questionId,
				optionIds: store.db
					.select({ optionId: pollResponseOptions.optionId })
					.from(pollResponseOptions)
					.where(eq(pollResponseOptions.responseId, responseId))
					.all()
					.map(({ optionId }) => optionId),
				// Do not reveal correctness or points before the admin releases results.
				isCorrect: question?.showResults ? !!response?.isCorrect : null,
				points: question?.showResults ? Number(response?.points ?? 0) : 0,
				correctOptionIds: []
			};
		});
}

export function submitChoiceResponse(
	store: Store,
	sessionId: string,
	questionId: string,
	token: string,
	optionIds: string[]
) {
	const auth = participantFor(store, sessionId, token);
	if (!auth || auth.session.state !== 'open') throw new UserError('Sesi tidak menerima jawaban.');
	const question = store.db
		.select()
		.from(pollQuestions)
		.where(and(eq(pollQuestions.id, questionId), eq(pollQuestions.kind, 'choice')))
		.get();
	const uniqueIds = [...new Set(optionIds)];
	const options = store.db
		.select()
		.from(pollOptions)
		.where(eq(pollOptions.questionId, questionId))
		.all();
	const selected = options.filter((option) => uniqueIds.includes(option.id));
	if (
		!question ||
		question.activityId !== auth.session.activityId ||
		selected.length !== uniqueIds.length ||
		uniqueIds.length === 0
	)
		throw new UserError('Pilihan tidak tersedia.');
	if (auth.session.quizMode === 'guided') {
		if (auth.session.activeQuestionId !== questionId)
			throw new UserError('Soal ini belum dibuka dosen.');
		if (auth.session.timerDeadline && auth.session.timerDeadline <= Date.now())
			throw new UserError('Waktu soal ini sudah habis.');
		if (auth.session.timerDeadline == null && auth.session.timerDuration > 0)
			throw new UserError('Timer sedang dijeda.');
	}
	const existing = store.db
		.select()
		.from(pollResponses)
		.where(
			and(
				eq(pollResponses.questionId, questionId),
				eq(pollResponses.participantId, auth.participant.id)
			)
		)
		.get();
	if (existing)
		return {
			...existing,
			optionIds: store.db
				.select({ optionId: pollResponseOptions.optionId })
				.from(pollResponseOptions)
				.where(eq(pollResponseOptions.responseId, existing.id))
				.all()
				.map((row) => row.optionId)
		};
	const correctIds = options
		.filter((option) => option.isCorrect)
		.map((option) => option.id)
		.sort();
	const selectedIds = uniqueIds.slice().sort();
	const isCorrect =
		correctIds.length === selectedIds.length &&
		correctIds.every((id, index) => id === selectedIds[index]);
	const row = {
		id: randomUUID(),
		questionId,
		sessionId,
		participantId: auth.participant.id,
		optionId: selectedIds[0],
		isCorrect,
		points: isCorrect ? 1000 : 0,
		createdAt: Date.now()
	};
	try {
		store.db.transaction((tx) => {
			tx.insert(pollResponses).values(row).run();
			tx.insert(pollResponseOptions)
				.values(selectedIds.map((optionId) => ({ responseId: row.id, optionId })))
				.run();
		});
		return { ...row, optionIds: selectedIds };
	} catch (error) {
		if (String(error).includes('UNIQUE')) {
			const retry = store.db
				.select()
				.from(pollResponses)
				.where(
					and(
						eq(pollResponses.questionId, questionId),
						eq(pollResponses.participantId, auth.participant.id)
					)
				)
				.get();
			if (retry)
				return {
					...retry,
					optionIds: store.db
						.select({ optionId: pollResponseOptions.optionId })
						.from(pollResponseOptions)
						.where(eq(pollResponseOptions.responseId, retry.id))
						.all()
						.map((item) => item.optionId)
				};
		}
		throw error;
	}
}

export function choiceTally(store: Store, sessionId: string, questionId: string) {
	const options = store.db
		.select({ id: pollOptions.id })
		.from(pollOptions)
		.where(eq(pollOptions.questionId, questionId))
		.orderBy(asc(pollOptions.position))
		.all();
	const statement = store.sqlite.prepare(
		`SELECT COUNT(*) AS n FROM poll_responses pr LEFT JOIN poll_response_options pro ON pro.response_id = pr.id WHERE pr.session_id = ? AND (pro.option_id = ? OR (pro.response_id IS NULL AND pr.option_id = ?))`
	);
	return Object.fromEntries(
		options.map((option) => [
			option.id,
			Number((statement.get(sessionId, option.id, option.id) as { n: number }).n)
		])
	);
}

export function participantScore(store: Store, sessionId: string, participantId: string) {
	return Number(
		store.db
			.select({ points: sum(pollResponses.points) })
			.from(pollResponses)
			.where(
				and(eq(pollResponses.sessionId, sessionId), eq(pollResponses.participantId, participantId))
			)
			.get()?.points ?? 0
	);
}

export function quizLeaderboard(store: Store, sessionId: string) {
	const rows = store.sqlite
		.prepare(
			`SELECT p.id AS participant_id, p.display_name AS display_name, COALESCE(SUM(r.points), 0) AS score, COUNT(DISTINCT r.question_id) AS answered FROM participants p LEFT JOIN poll_responses r ON r.participant_id = p.id AND r.session_id = ? WHERE p.session_id = ? GROUP BY p.id, p.display_name ORDER BY score DESC, answered DESC, p.display_name COLLATE NOCASE ASC`
		)
		.all(sessionId, sessionId) as {
		participant_id: string;
		display_name: string;
		score: number;
		answered: number;
	}[];
	return rows.map((row, index) => ({
		rank: index + 1,
		participantId: row.participant_id,
		displayName: row.display_name,
		score: Number(row.score),
		answered: Number(row.answered)
	}));
}
