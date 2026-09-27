import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message } from '$lib/server/http';
import { choiceResponseSchema } from '$lib/poll/validation';
import { choiceTally, getChoiceQuestion, submitChoiceResponse } from '$lib/server/poll/choice';
import { events } from '$lib/server/events';
import { sessionByCode } from '$lib/server/sessions';
import { hashToken } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { pollQuestions } from '$lib/server/db/schema';
export const POST: import('./$types').RequestHandler = async (event) => {
	const store = database();
	const session = event.params.sessionCode
		? sessionByCode(store, event.params.sessionCode)
		: undefined;
	if (!session) return json({ ok: false, message: 'Sesi tidak tersedia.' }, { status: 404 });
	try {
		const { questionId, optionIds } = choiceResponseSchema.parse(await body(event));
		const question = store.db
			.select()
			.from(pollQuestions)
			.where(eq(pollQuestions.id, questionId))
			.get();
		if (!question || question.activityId !== session.activityId)
			return json({ ok: false, message: 'Pertanyaan tidak tersedia.' }, { status: 404 });
		const token = event.cookies.get(`edu_p_${session.id}`);
		if (!token)
			return json({ ok: false, message: 'Peserta belum terautentikasi.' }, { status: 401 });
		const before = store.sqlite
			.prepare(
				'SELECT id FROM poll_responses WHERE question_id = ? AND participant_id IN (SELECT id FROM participants WHERE token_hash = ?)'
			)
			.get(question.id, hashToken(token));
		const response = submitChoiceResponse(store, session.id, question.id, token, optionIds);
		const currentQuestion = getChoiceQuestion(store, question.id)!;
		const lastEventId = events.publish(session.id, 'poll.tally', {
			questionId: question.id,
			counts: currentQuestion.showResults ? choiceTally(store, session.id, question.id) : undefined
		});
		const released = currentQuestion.showResults;
		return json({
			ok: true,
			alreadySubmitted: !!before,
			responseId: response.id,
			lastEventId,
			showResults: released,
			...(released
				? {
						isCorrect: response.isCorrect,
						points: response.points,
						correctOptionIds: currentQuestion.options
							.filter((option) => option.isCorrect)
							.map((option) => option.id),
					tally: choiceTally(store, session.id, question.id)
					}
				: {})
		});
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
