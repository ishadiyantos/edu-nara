import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message } from '$lib/server/http';
import { wordcloudResponseSchema } from '$lib/poll/validation';
import { sessionByCode, authorizeSession } from '$lib/server/sessions';
import {
	participantWordcloudResponses,
	submitWordcloudResponse,
	wordcloudSnapshot
} from '$lib/server/poll/wordcloud';

export const GET: import('./$types').RequestHandler = (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	if (!session) return json({ ok: false, message: 'Session not available.' }, { status: 404 });
	const token = event.cookies.get(`edu_p_${session.id}`);
	if (!authorizeSession(store, session.id, event.locals.admin?.id, token))
		return json({ ok: false }, { status: 401 });
	const words = event.url.searchParams.get('questionId')
		? wordcloudSnapshot(store, session.id, String(event.url.searchParams.get('questionId')))
		: [];
	return json(
		{
			ok: true,
			words,
			responses: token ? participantWordcloudResponses(store, session.id, token) : []
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};

export const POST: import('./$types').RequestHandler = async (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	if (!session) return json({ ok: false, message: 'Session not available.' }, { status: 404 });
	const token = event.cookies.get(`edu_p_${session.id}`);
	if (!token)
		return json({ ok: false, message: 'Participant not authenticated.' }, { status: 401 });
	try {
		const data = wordcloudResponseSchema.parse(await body(event));
		const result = submitWordcloudResponse(store, session.id, data.questionId, token, data.word);
		return json({
			ok: true,
			responseId: result.row.id,
			word: result.row.word,
			status: result.row.status,
			alreadySubmitted: result.alreadySubmitted,
			lastEventId: result.lastEventId
		});
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
