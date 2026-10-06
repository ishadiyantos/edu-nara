import { json } from '@sveltejs/kit';
import { body, message } from '$lib/server/http';
import { database } from '$lib/server/db/client';
import { participantCrosswordProgress, saveCrosswordProgress } from '$lib/server/crossword';
import { sessionByCode } from '$lib/server/sessions';

export const GET: import('./$types').RequestHandler = (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	const token = session && event.cookies.get(`edu_p_${session.id}`);
	if (!session || !token)
		return json({ ok: false, message: 'Participant not authenticated.' }, { status: 401 });
	try {
		return json(
			{ ok: true, progress: participantCrosswordProgress(store, session.id, token) },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 401 });
	}
};

export const POST: import('./$types').RequestHandler = async (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	const token = session && event.cookies.get(`edu_p_${session.id}`);
	if (!session || !token)
		return json({ ok: false, message: 'Participant not authenticated.' }, { status: 401 });
	try {
		return json({
			ok: true,
			progress: saveCrosswordProgress(store, session.id, token, await body(event))
		});
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
